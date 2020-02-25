/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

import * as moment from 'moment';
import { titleCase } from 'title-case';

export class CheckLeadActivityStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a Marketo Lead\'s Activity';
  protected stepExpression: string = 'there should be an? (?<activityTypeIdOrName>.+) activity for marketo lead (?<email>.+) in the last (?<minutes>\\d+) minutes?';
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
    field: 'minutes',
    type: FieldDefinition.Type.NUMERIC,
    description: 'The number of minutes prior to now to use when filtering the activity feed',
  }, {
    field: 'withAttributes',
    type: FieldDefinition.Type.MAP,
    description: 'Represents additional parameters that should be used to validate an activity. The key in the object represents an attribute name and the value represents the expected value',
    optionality: FieldDefinition.Optionality.OPTIONAL,
  }];

  protected expectedRecords: ExpectedRecord[] = [{
    id: 'matchedActivities',
    type: RecordDefinition.Type.TABLE,
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
    const email = stepData.email;
    let activityTypeIdOrName = stepData.activityTypeIdOrName;
    const minutesAgo = stepData.minutes;
    const withAttributes = stepData.withAttributes || {};

    try {
      const sinceDate = moment().subtract(minutesAgo, 'minutes').utc().format(moment.defaultFormatUtc);
      const tokenResponse = await this.client.getActivityPagingToken(sinceDate);
      const nextPageToken = tokenResponse.nextPageToken;

      const lead = (await this.client.findLeadByEmail(email)).result[0];

      /* Error when lead is not found */
      if (!lead) {
        return this.error('Lead %s was not found', [
          email,
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

      const activityResponse = await this.client.getActivities(nextPageToken, lead.id, activityTypeIdOrName);
      const activities = activityResponse.result;

      /* Fail when when the activity supplied is not found in the lead's logs. */
      if (!activities) {
        return this.fail('No %s activity found for lead %s within the last %d minute(s)', [
          stepData.activityTypeIdOrName,
          email,
          minutesAgo,
        ]);
      }

<<<<<<< HEAD
      const activityRecords = this.createRecords(activities);
      activityRecords.setName(`Matched "${activityType.name}" Activities`);
=======
      const headers = { id: 'ID', leadId: 'Lead ID', activityDate: 'Activity Date', activityTypeId: 'Activity Type ID' };
      const activityRecords = this.table('matchedActivities', `Matched ${activityType.name} Records`, headers, activities);
>>>>>>> Conflicts

      /* Expected attributes passed to test step. Translate object/map as array for easier comparison with actual attributes */
      const expectedAttributes = Object.keys(withAttributes).map((key) => { return { name: key, value: withAttributes[key] }; });

      /* Assert Actual vs Expected attributes and pass if at least one activity matches attributes. Otherwise fail */
      if (expectedAttributes.length > 0) {
        let validated = false;
        for (const activity of activities) {
          const primaryAttribute = this.getPrimaryAttribute(activityTypes, activity);
          const actualAttributes = activity.attributes;
          if (primaryAttribute) {
            actualAttributes.push(primaryAttribute);
          }

          if (this.hasMatchingAttributes(actualAttributes, expectedAttributes)) {
            validated = true;
            break;
          }
        }

        if (validated) {
          return this.pass('Found %s activity for lead %s within the last %d minute(s), including attributes: \n\n', [
            stepData.activityTypeIdOrName,
            email,
            minutesAgo,
            JSON.stringify(expectedAttributes, null, 2),
          ],               [activityRecords]);
        }

        const attributes = [];
        activities.forEach((activity) => {
          const obj = {};
          activity.attributes.forEach((attr) => {
            obj[attr.name] = attr.value;
          });
          attributes.push(obj);
        });

        return this.fail(
          'Found %s activity for lead %s within the last %d minute(s), but none matched the expected attributes (%s). Found the following similar activities:\n\n%s',
          [
            stepData.activityTypeIdOrName,
            email,
            minutesAgo,
            expectedAttributes.map(attr => `${attr.name} = ${attr.value}`).join(', '),
            stepData.activityTypeIdOrName,
            attributes.map(attr => JSON.stringify(attr, null, 2)).join('\n\n'),
          ],
          [activityRecords]);
      }

      return this.pass(
        '%s activity found for lead %s within the last %d minute(s)',
        [stepData.activityTypeIdOrName, email, minutesAgo],
        [activityRecords],
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
    activities.forEach((activity) => {
      activity.attributes.forEach(attr => activity[attr.name] = attr.value);
      records.push(activity);
    });
    const headers = { id: 'ID', leadId: 'Lead ID', activityDate: 'Activity Date', activityTypeId: 'Activity Type ID' };
    activities[0].attributes.forEach(attr => headers[attr.name] = titleCase(attr.name));
    return this.table('matchedActivities', '', headers, records);
  }
}

export { CheckLeadActivityStep as Step };
