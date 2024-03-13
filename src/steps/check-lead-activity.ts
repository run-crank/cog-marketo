import { titleCase } from 'title-case';
/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../proto/cog_pb';

import * as moment from 'moment';

export class CheckLeadActivityStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a Marketo lead\'s activity';
  protected stepExpression: string = 'there should (?<includes>not include|be|not be) an? (?<activityTypeIdOrName>.+) activity for marketo lead (?<email>.+) in the last (?<minutes>\\d+) minutes?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected actionList: string[] = ['check'];
  protected targetObject: string = 'Lead Activity';
  protected expectedFields: Field[] = [{
    field: 'email', // to prevent breaking previous scenarios, this is will stay as email
    type: FieldDefinition.Type.STRING,
    description: 'The email address or id of the Marketo Lead',
    bulksupport: true,
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
  }, {
    id: 'passedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }, {
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: 'email of Marketo Lead (if provided)',
    }, {
      field: 'activityId',
      type: FieldDefinition.Type.NUMERIC,
      description: "Activity's ID",
    }, {
      field: 'activityDate',
      type: FieldDefinition.Type.DATETIME,
      description: "Activity's Date",
    }, {
      field: 'activityTypeId',
      type: FieldDefinition.Type.NUMERIC,
      description: "Activity Type's ID",
    }],
  }, {
    id: 'failedLeads',
    type: RecordDefinition.Type.TABLE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: 'ID of Marketo Lead',
    }, {
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: 'email of Marketo Lead (if provided)',
    }, {
      field: 'message',
      type: FieldDefinition.Type.STRING,
      description: 'Message for explanation of fail',
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const reference: string = stepData.email;
    let activityTypeIdOrName = stepData.activityTypeIdOrName;
    const includes = stepData.includes ? stepData.includes === 'be' : true;
    const minutesAgo = stepData.minutes;
    const withAttributes = stepData.withAttributes || {};
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;

    try {
      const sinceDate = moment().subtract(minutesAgo, 'minutes').utc().format(moment.defaultFormatUtc);
      const tokenResponse = await this.client.getActivityPagingToken(sinceDate);

      const nextPageToken = tokenResponse.nextPageToken;

      const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
      let lookupField = 'id';
      const activityTypes = (await this.client.getActivityTypes()).result;
      const activityType = activityTypes.find(type => type[isNaN(activityTypeIdOrName) ? 'name' : 'id'] == activityTypeIdOrName);
      /* Error when activity is not found */
      if (!activityType) {
        return this.error('%s is not a known activity type.', [
          stepData.activityTypeIdOrName,
        ]);
      }

      activityTypeIdOrName = activityType.id;

      /* Expected attributes passed to test step. Translate object/map as array for easier comparison with actual attributes */
      const expectedAttributes = Object.keys(withAttributes).map((key) => { return { name: key, value: withAttributes[key] }; });
      if ((stepData.multiple_email && Array.isArray(stepData.multiple_email) && stepData.multiple_email.length > 0) ||
          (stepData.multiple_id && Array.isArray(stepData.multiple_id) && stepData.multiple_id.length > 0)) {
        // Checking multiple leads
        const leadIds = stepData.multiple_id || [];
        const leadEmails = {};
        const failedArray = [];
        const passedArray = [];

        // If email is provided, first fetch all the leads and get their IDs
        if (stepData.multiple_email && stepData.multiple_email.length > 0) {
          lookupField = 'email';
          const response = await this.client.bulkFindLeadsByEmail(stepData.multiple_email, null, partitionId);

          if (!response[0].success) {
            return this.error('There was an error finding the leads in Marketo', [], []);
          }

          const leads = response[0].result;

           // Error if any leads aren't found
          if (leads.length !== stepData.multiple_email.length) {
            return this.fail('Not all leads were found%s', [
              partitionId ? ` in partition ${partitionId}` : '',
            ]);
          }

          await leads.forEach((lead) => {
            leadIds.push(lead.id);
            leadEmails[lead.id] = lead.email;
          });
        }
        const activityResponse = await this.client.getActivitiesByLeadId(nextPageToken, leadIds, activityTypeIdOrName);
        const activities = activityResponse.result;

        // Fail when when no activities were found for any leads.
        if (!activities.length) {
          return this[includes ? 'fail' : 'pass']('No %s activity found for the provided leads within the last %d minute(s)', [
            stepData.activityTypeIdOrName,
            minutesAgo,
          ]);
        }

        // Loop through all leads
        for (const leadId of leadIds) {
          // Filter out all activities for current lead
          const currLeadActivities = activities.filter(act => act.leadId === leadId);
          const leadEmail = leadEmails[leadId] || '';

          if (!currLeadActivities.length) {
            // If no activities are found, push to failed array
            failedArray.push({ id: leadId, email: leadEmail, message: `No activities found for lead ${lookupField === 'email' ? leadEmail : leadId} within the last ${minutesAgo} minute(s)` });
            continue;
          }

          if (!expectedAttributes.length) {
            // If there are no additional attributes to check, push first activity that matches to passed array
            const first = currLeadActivities[0];
            passedArray.push({ id: leadId, email: leadEmail, activityId: first.id, activityTypeId: first.activityTypeId, activityDate: first.activityDate });
            continue;
          } else {
            // If there are expected attributes, loop through each of currLeadActivities
            let validated = false;
            let validatedActivity;

            for (const activity of currLeadActivities) {
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

              // Check if expected atributes are on current activity
              if (this.hasMatchingAttributes(actualAttributes, expectedAttributes)) {
                validated = true;
                validatedActivity = activity;
                break;
              }
            }

            if (validated) {
              // If there was an activity with all expected attributes, push to passed array
              passedArray.push({ id: leadId, email: leadEmail, activityId: validatedActivity.id, activityTypeId: validatedActivity.activityTypeId, activityDate: validatedActivity.activityDate });
              continue;
            } else {
              // If none contain all expected attributes, push to fail array
              failedArray.push({ id: leadId, email: leadEmail, message: `Found ${activityTypeIdOrName} activity for lead ${leadEmail || leadId} within the last ${minutesAgo} minute(s), but none matched the expected attributes ${expectedAttributes.map(attr => `${attr.name} = ${attr.value}`).join(', ')}` });
            }
          }
        }

        const records = [];
        if (includes) {
          // When user is expecting activities to be found
          if (!failedArray.length) {
            // all leads passed
            records.push(this.createTable('passedLeads', 'Leads Passed', passedArray));
            if (expectedAttributes.length) {
              return this.pass(
                'Found %s activity for all leads within the last %d minute(s), including attributes: \n\n%s',
                [stepData.activityTypeIdOrName, minutesAgo, JSON.stringify(expectedAttributes, null, 2)],
                records,
              );
            } else {
              return this.pass(
                'Found %s activity for all leads within the last %d minute(s)',
                [stepData.activityTypeIdOrName, minutesAgo],
                records,
              );
            }

          } else if (failedArray.length && passedArray.length) {
            // some leads passed and some failed
            records.push(this.createTable('passedLeads', 'Leads Passed', passedArray));
            records.push(this.createTable('failedLeads', 'Leads Failed', failedArray));
            if (expectedAttributes.length) {
              return this.fail(
                'Found %s activity for %d out of %d leads within the last %d minute(s), including attributes: \n\n%s',
                [stepData.activityTypeIdOrName, passedArray.length, leadIds.length, minutesAgo, JSON.stringify(expectedAttributes, null, 2)],
                records,
              );
            } else {
              return this.fail(
                'Found %s activity for %d out of %d leads within the last %d minute(s)',
                [stepData.activityTypeIdOrName, passedArray.length, leadIds.length, minutesAgo],
                records,
              );
            }
          } else {
            // all leads failed
            records.push(this.createTable('failedLeads', 'Leads Failed', failedArray));
            if (expectedAttributes.length) {
              return this.fail(
                'Did not find %s activity for any leads within the last %d minute(s) that included attributes: \n\n%s',
                [stepData.activityTypeIdOrName, minutesAgo, JSON.stringify(expectedAttributes, null, 2)],
                records,
              );
            } else {
              return this.fail(
                'Did not find %s activity for any leads within the last %d minute(s)',
                [stepData.activityTypeIdOrName, minutesAgo],
                records,
              );
            }
          }
        } else {
          // When user is expecting NO activities to be found
          // NOTE: passed and failed arrays still contain the same info (passed = leads where the activity was found), but mean the opposite in this else block
          if (!passedArray.length) {
            // no activities were found, so the step passes
            records.push(this.createTable('passedLeads', 'Leads Passed', failedArray));
            if (expectedAttributes.length) {
              return this.pass(
                'Did not find %s activity for any leads within the last %d minute(s) that included attributes: \n\n%s',
                [stepData.activityTypeIdOrName, minutesAgo, JSON.stringify(expectedAttributes, null, 2)],
                records,
              );
            } else {
              return this.pass(
                'Did not find %s activity for any leads within the last %d minute(s)',
                [stepData.activityTypeIdOrName, minutesAgo],
                records,
              );
            }
          } else if (failedArray.length && passedArray.length) {
            // some leads passed and some failed
            records.push(this.createTable('passedLeads', 'Leads Passed', failedArray)); // Note these are flipped intentionally, as the passedLeads record should contain leads where the activity was not found
            records.push(this.createTable('failedLeads', 'Leads Failed', passedArray));
            if (expectedAttributes.length) {
              return this.fail(
                'Found %s activity for %d out of %d leads within the last %d minute(s), including attributes: \n\n%s',
                [stepData.activityTypeIdOrName, passedArray.length, leadIds.length, minutesAgo, JSON.stringify(expectedAttributes, null, 2)],
                records,
              );
            } else {
              return this.fail(
                'Found %s activity for %d out of %d leads within the last %d minute(s)',
                [stepData.activityTypeIdOrName, passedArray.length, leadIds.length, minutesAgo],
                records,
              );
            }
          } else {
            // all activities were found, so the step fails
            records.push(this.createTable('failedLeads', 'Leads Failed', passedArray));
            if (expectedAttributes.length) {
              return this.fail(
                'Found %s activity for all leads within the last %d minute(s), including attributes: \n\n%s',
                [stepData.activityTypeIdOrName, minutesAgo, JSON.stringify(expectedAttributes, null, 2)],
                records,
              );
            } else {
              return this.fail(
                'Found %s activity for all leads within the last %d minute(s)',
                [stepData.activityTypeIdOrName, minutesAgo],
                records,
              );
            }
          }
        }

      } else {
        // Only checking one lead
        if (emailRegex.test(reference)) {
          lookupField = 'email';
        }

        const lead = (await this.client.findLeadByField(lookupField, reference, null, partitionId)).result[0];

        /* Error when lead is not found OR if lead is an empty object */
        if (!lead || !Object.keys(lead).length) {
          return this.fail('Lead %s was not found%s', [
            reference,
            partitionId ? ` in partition ${partitionId}` : '',
          ]);
        }

        const activityResponse = await this.client.getActivitiesByLeadId(nextPageToken, lead.id, activityTypeIdOrName);
        const activities = activityResponse.result;

        /* Fail when when the activity supplied is not found in the lead's logs. */
        if (!activities.length) {
          return this[includes ? 'fail' : 'pass']('No %s activity found for lead %s within the last %d minute(s)', [
            stepData.activityTypeIdOrName,
            reference,
            minutesAgo,
          ]);
        }

        /* Assert Actual vs Expected attributes and pass if at least one activity matches attributes. Otherwise fail */
        if (expectedAttributes.length > 0) {
          let validated = false;
          let validatedActivity;
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
              [stepData.activityTypeIdOrName, reference, minutesAgo, JSON.stringify(expectedAttributes, null, 2)],
              [this.createRecord(validatedActivity)],
            );
          }

          const activityRecords = this.createRecords(activities);
          activityRecords.setName(`Matched "${activityType.name}" Activities`);

          return this[includes ? 'fail' : 'pass'](
            'Found %s activity for lead %s within the last %d minute(s), but none matched the expected attributes (%s).',
            [
              stepData.activityTypeIdOrName,
              reference,
              minutesAgo,
              expectedAttributes.map(attr => `${attr.name} = ${attr.value}`).join(', '),
            ],
            [activityRecords],
          );
        }

        return this[includes ? 'pass' : 'fail'](
          '%s activity found for lead %s within the last %d minute(s)',
          [stepData.activityTypeIdOrName, reference, minutesAgo],
          [this.createRecord(activities[0])],
        );
      }

    } catch (e) {
      console.log(e);
      return this.error('There was an error checking activities for Marketo Lead: %s', [
        e.toString(),
      ]);
    }
  }

  hasMatchingAttributes(actualAttributes: any[], expectedAttributes: any[]): boolean {
    // OLD and replaced with code below for readability and simplicity
    // This will intersect actual vs expected; If the count of intersection and expected is same. All attributes have been matched.
    // const intersection = actualAttributes.filter(actual => expectedAttributes.find(expected => expected.name == actual.name && expected.value == actual.value) !== undefined);
    // return intersection.length === expectedAttributes.length;

    // loop through expected attributes, if ANY aren't found in the actual attributes, return false
    for (const expected of expectedAttributes) {
      if (actualAttributes.find(actual => actual.name == expected.name && actual.value == expected.value) === undefined) {
        return false;
      }
    }

    return true;
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

  // Used only by singular version of this step, not used when checking multiple leads at once
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

  // Used only by bulk version of this step
  createTable(id: string, name: string, leads: any[]): StepRecord {
    const headers = {};
    const headerKeys = Object.keys(leads[0] || {});
    headerKeys.forEach((key: string) => {
      headers[key] = key;
    });
    return this.table(id, name, headers, leads);
  }
}

export { CheckLeadActivityStep as Step };
