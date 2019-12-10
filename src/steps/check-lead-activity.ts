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
    description: 'The activity type ID (integer) or name',
  }, {
    field: 'minutes',
    type: FieldDefinition.Type.NUMERIC,
    description: 'The number of minutes prior to now to use when filtering the activity feed',
  }, {
    field: 'withAttributes',
    type: FieldDefinition.Type.MAP,
    description: 'Represents additional parameters that should be used to validate an event. The key in the object represents an attribute name and the value represents the expected value',
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
      const tokenResponse = await this.client.getPagingToken(sinceDate);
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
        return this.fail('Activity %s was not found for lead %s for the last %s minute(s)', [
          stepData.activityTypeIdOrName,
          email,
          minutesAgo,
        ]);
      }

      /* Map the primary attributes of all activities found */
      const actualPrimaryAttributes = [].concat.apply([], activities.map((activity) => {
        /* Find the name of the primary attribute from activityTypes to create a name,value for the primary attributes */
        const activityType = activityTypes.find(at => at.id == activity.activityTypeId);

        if (activityType) {
          if (activityType.primaryAttribute) {
            return {
              name: activityType.primaryAttribute.name,
              value: activity.primaryAttributeValue,
            };
          }
        }
      }));

      /* Map the secondary attributes of all activities found and join them with the primary */
      const actualAttributes = [].concat.apply([], activities.map(a => a.attributes).concat(actualPrimaryAttributes));

      /* Expected attributes passed to test step. Translate object/map as array for easier comparison with actual attributes */
      const expectedAttributes = Object.keys(withAttributes).map((key) => { return { name: key, value: withAttributes[key] }; });

      /* Match attributes only when expectedAttributes are provided. Otherwise, when we reach this point. The expected activity is found from the logs */
      if (expectedAttributes.length > 0) {
        /* We only need at least one matching attributes to pass the check */
        if (this.hasAtLeastOneMatch(actualAttributes, expectedAttributes)) {
          return this.pass('Activity %s was found for lead %s for the last %s minute(s). With expected attributes: \n\n', [
            stepData.activityTypeIdOrName,
            email,
            minutesAgo,
            JSON.stringify(expectedAttributes),
          ]);
        } else {
          return this.fail('Expected attributes of activity %s for lead %s for the last %d minute(s) did not match the actual activity attributes. Actual attributes are: \n\n', [
            stepData.activityTypeIdOrName,
            email,
            minutesAgo,
            JSON.stringify(actualAttributes),
          ]);
        }
      } else {
        return this.pass('Activity %s was found for lead %s for the last %d minute(s)', [
          stepData.activityTypeIdOrName,
          email,
          minutesAgo,
        ]);
      }
    } catch (e) {
      return this.error('There was an checking Activities for Marketo Lead: %s', [
        e.toString(),
      ]);
    }
  }

  hasAtLeastOneMatch(actualAttributes: any[], expectedAttributes: any[]): boolean {
    const intersection = actualAttributes.filter(value => expectedAttributes.find(f => f.name == value.name && f.id == value.id) !== undefined);
    return intersection.length > 0;
  }
}

export { CheckLeadActivityStep as Step };
