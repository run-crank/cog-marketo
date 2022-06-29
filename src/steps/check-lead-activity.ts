import { titleCase } from 'title-case';
/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

import * as moment from 'moment';

export class CheckLeadActivityStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a Marketo Lead\'s Activity';
  protected stepExpression: string = 'there should (?<includes>be|not be) an? (?<activityTypeIdOrName>.+) activity for marketo lead (?<email>.+) in the last (?<minutes>\\d+) minutes?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: 'The email address of the Marketo Lead',
  }, {
    field: 'activityTypeIdOrName',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'The activity type ID (number) or name',
  }, {
    field: 'includes',
    type: FieldDefinition.Type.STRING,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'Check Logic if there is the activity for Marketo Lead (be, not be)',
  }, {
    field: 'minutes',
    type: FieldDefinition.Type.NUMERIC,
    description: 'The number of minutes prior to now to use when filtering the activity feed',
  }, {
    field: 'withAttributes',
    type: FieldDefinition.Type.MAP,
    description: 'Represents additional parameters that should be used to validate an activity. The key in the object represents an attribute name and the value represents the expected value',
    optionality: FieldDefinition.Optionality.OPTIONAL,
  }, {
    field: 'partitionId',
    type: FieldDefinition.Type.NUMERIC,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'ID of partition lead belongs to',
    help: 'Only necessary to provide if Marketo has been configured to allow duplicate leads by email.',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'activity',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Activity's Marketo ID",
    }, {
      field: 'leadId',
      type: FieldDefinition.Type.NUMERIC,
      description: "Lead's Marketo ID",
    }, {
      field: 'activityDate',
      type: FieldDefinition.Type.DATETIME,
      description: "Activity's Date",
    }, {
      field: 'activityTypeId',
      type: FieldDefinition.Type.NUMERIC,
      description: "Activity Type's ID",
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const email: string = stepData.email;
    let activityTypeIdOrName = stepData.activityTypeIdOrName;
    const includes = stepData.includes ? stepData.includes === 'be' : true;
    const minutesAgo = stepData.minutes;
    const withAttributes = stepData.withAttributes || {};
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;

    try {
      const sinceDate = moment().subtract(minutesAgo, 'minutes').utc().format(moment.defaultFormatUtc);
      const tokenResponse = await this.client.getActivityPagingToken(sinceDate);

      const nextPageToken = tokenResponse.nextPageToken;

      const lead = (await this.client.findLeadByEmail(email, null, partitionId)).result[0];

      /* Error when lead is not found */
      if (!lead) {
        return this.fail('Lead %s was not found%s', [
          email,
          partitionId ? ` in partition ${partitionId}` : '',
        ]);
      }

      const activityTypes = (await this.client.getActivityTypes()).result;
      const activityType = activityTypes.find(type => type[isNaN(activityTypeIdOrName) ? 'name' : 'id'] == activityTypeIdOrName);

      /* Error when activity is not found */
      if (!activityType) {
        return this.error('%s is not a known activity type.', [
          stepData.activityTypeIdOrName,
        ]);
      }

      activityTypeIdOrName = activityType.id;

      const activityResponse = await this.client.getActivitiesByLeadId(nextPageToken, lead.id, activityTypeIdOrName);
      const activities = activityResponse.result;

      /* Fail when when the activity supplied is not found in the lead's logs. */
      if (!activities) {
        return this[includes ? 'fail' : 'pass']('No %s activity found for lead %s within the last %d minute(s)', [
          stepData.activityTypeIdOrName,
          email,
          minutesAgo,
        ]);
      }

      /* Expected attributes passed to test step. Translate object/map as array for easier comparison with actual attributes */
      const expectedAttributes = Object.keys(withAttributes).map((key) => { return { name: key, value: withAttributes[key] }; });
      let validatedActivity;

      /* Assert Actual vs Expected attributes and pass if at least one activity matches attributes. Otherwise fail */
      if (expectedAttributes.length > 0) {
        let validated = false;
        for (const activity of activities) {
          const primaryAttribute = this.getPrimaryAttribute(activityTypes, activity);
          const actualAttributes = activity.attributes;

          Object.keys(activity).forEach((key) => {
            if (key !== 'attributes') {
              actualAttributes.push({
                name: key,
                value: activity[key],
              });
            }
          });

          if (primaryAttribute) {
            actualAttributes.push(primaryAttribute);
          }

          if (this.hasMatchingAttributes(actualAttributes, expectedAttributes)) {
            validated = true;
            validatedActivity = activity;
            break;
          }
        }

        if (validated) {
          return this[includes ? 'pass' : 'fail'](
            'Found %s activity for lead %s within the last %d minute(s), including attributes: \n\n%s',
            [stepData.activityTypeIdOrName, email, minutesAgo, JSON.stringify(expectedAttributes, null, 2)],
            [this.createRecord(validatedActivity)],
          );
        }

        const activityRecords = this.createRecords(activities);
        activityRecords.setName(`Matched "${activityType.name}" Activities`);

        return this.fail(
          'Found %s activity for lead %s within the last %d minute(s), but none matched the expected attributes (%s).',
          [
            stepData.activityTypeIdOrName,
            email,
            minutesAgo,
            expectedAttributes.map(attr => `${attr.name} = ${attr.value}`).join(', '),
          ],
          [activityRecords],
        );
      }

      return this[includes ? 'pass' : 'fail'](
        '%s activity found for lead %s within the last %d minute(s)',
        [stepData.activityTypeIdOrName, email, minutesAgo],
        [this.createRecord(activities[0])],
      );

    } catch (e) {
      return this.error('There was an error checking activities for Marketo Lead: %s', [
        e.toString(),
      ]);
    }
  }

  hasMatchingAttributes(actualAttributes: any[], expectedAttributes: any[]): boolean {
    /* This will intersect actual vs expected; If the count of intersection and expected is same. All attributes have been matched. */
    const intersection = actualAttributes.filter(actual => expectedAttributes.find(expected => expected.name == actual.name && expected.value == actual.value) !== undefined);
    return intersection.length === expectedAttributes.length;
  }

  getPrimaryAttribute(activityTypes, activity) {
    let result = undefined;

    const activityType = activityTypes.find(at => at.id == activity.activityTypeId);

    if (activityType) {
      if (activityType.primaryAttribute) {
        result = {
          name: activityType.primaryAttribute.name,
          value: activity.primaryAttributeValue,
        };
      }
    }

    return result;
  }

  createRecords(activities) {
    const records = [];
    const headers = { id: 'ID', leadId: 'Lead ID', activityDate: 'Activity Date', activityTypeId: 'Activity Type ID' };
    activities[0].attributes.forEach(attr => headers[attr.name] = titleCase(attr.name));

    activities.forEach((activity) => {
      activity.attributes.forEach(attr => activity[attr.name] = attr.value);
      delete activity.attributes;
      records.push(activity);
    });

    return this.table('matchedActivities', '', headers, records);
  }

  createRecord(activity) {
    if (activity.hasOwnProperty('attributes')) {
      activity.attributes.forEach(attr => activity[attr.name] = attr.value);
      delete activity.attributes;
    }

    return this.keyValue('activity', 'Checked Activity', activity);
  }
}

export { CheckLeadActivityStep as Step };
