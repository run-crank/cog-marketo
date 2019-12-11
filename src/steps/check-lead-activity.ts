/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition } from '../proto/cog_pb';

import * as moment from 'moment';

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
        return this.error('Activity with ID or Name %s was not found.', [
          stepData.activityTypeIdOrName,
        ]);
      }

      activityTypeIdOrName = activityType.id;

      const activityResponse = await this.client.getActivities(nextPageToken, lead.id, activityTypeIdOrName);
      const activities = activityResponse.result;

      /* Fail when when the activity supplied is not found in the lead's logs. */
      if (!activities) {
        return this.fail('Activity %s was not found for lead %s within the last %d minute(s)', [
          stepData.activityTypeIdOrName,
          email,
          minutesAgo,
        ]);
      }

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
          return this.pass('Activity %s was found for lead %s within the last %s minute(s). With expected attributes: \n\n', [
            stepData.activityTypeIdOrName,
            email,
            minutesAgo,
            JSON.stringify(expectedAttributes, null, 2),
          ]);
        }

        return this.fail('Expected attributes of activity %s for lead %s within the last %d minute(s) did not match the actual activity attributes. Actual attributes: \n\n', [
          stepData.activityTypeIdOrName,
          email,
          minutesAgo,
          JSON.stringify(activities.map(activity => activity.attributes), null, 2),
        ]);
      }

      return this.pass('Activity %s was found for lead %s within the last %d minute(s)', [
        stepData.activityTypeIdOrName,
        email,
        minutesAgo,
      ]);

    } catch (e) {
      return this.error('There was an error checking Activities for Marketo Lead: %s', [
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
}

export { CheckLeadActivityStep as Step };
