import { isNullOrUndefined } from 'util';
/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class CustomObjectFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on a Marketo Custom Object';
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on the (?<name>.+) marketo custom object linked to lead (?<linkValue>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain) ?(?<expectedValue>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'name',
    type: FieldDefinition.Type.STRING,
    description: "Custom Object's API name",
  }, {
    field: 'linkValue',
    type: FieldDefinition.Type.EMAIL,
    description: "Linked Lead's email address",
  }, {
    field: 'field',
    type: FieldDefinition.Type.STRING,
    description: 'Field name to check',
  }, {
    field: 'operator',
    type: FieldDefinition.Type.STRING,
    description: 'Check Logic (be, not be, contain, not contain, be greater than, be less than, be set, not be set, be one of, or not be one of)',
  }, {
    field: 'expectedValue',
    type: FieldDefinition.Type.ANYSCALAR,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'The expected value of the field',
  }, {
    field: 'dedupeFields',
    type: FieldDefinition.Type.MAP,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'Map of custom dedupeFields data whose keys are field names.',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'customObject',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'marketoGUID',
      type: FieldDefinition.Type.STRING,
      description: "Custom Object's Marketo GUID",
    }, {
      field: 'createdAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Custom Object's create date",
    }, {
      field: 'updatedAt',
      type: FieldDefinition.Type.DATETIME,
      description: "Custom Object's last update date",
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const name = stepData.name;
    const linkValue = stepData.linkValue;
    const field = stepData.field;
    const operator = stepData.operator;
    const expectedValue = stepData.expectedValue;
    const dedupeFields = stepData.dedupeFields;

    if (isNullOrUndefined(expectedValue) && !(operator == 'be set' || operator == 'not be set')) {
      return this.error("The operator '%s' requires an expected value. Please provide one.", [operator]);
    }

    try {
      const customObject = await this.client.getCustomObject(name);
      // Custom Object exists validation
      if (!customObject.result.length) {
        return this.error('Error finding %s: no such marketo custom object', [
          name,
        ]);
      }

      // Linked to lead validation
      if (!customObject.result[0].relationships || !customObject.result[0].relationships.some(relationship => relationship.relatedTo.name == 'Lead')) {
        return this.error("Error finding %s linked to %s: this custom object isn't linked to leads", [
          name,
          linkValue,
        ]);
      }

      // @todo Remove describe related linkField value assignement code once marketo custom object bug is fixed
      // Getting of api name of field if relateTo field is Display Name
      const leadDescribe = await this.client.describeLeadFields();
      const linkField = leadDescribe.result.find(field => field.displayName == customObject.result[0].relationships[0].relatedTo.field)
                      ?  leadDescribe.result.find(field => field.displayName == customObject.result[0].relationships[0].relatedTo.field).rest.name
                      : customObject.result[0].relationships[0].relatedTo.field;

      // Getting link field value from lead
      const lead = await this.client.findLeadByEmail(linkValue);

      // Check if lead exists
      if (!lead.result.length) {
        return this.error('Error finding %s: the %s lead does not exist.', [name, linkValue]);
      }

      // Assign Query Params
      const searchFields = [{ [customObject.result[0].relationships[0].field]: lead.result[0][linkField] }];
      const filterType = customObject.result[0].relationships[0].field;
      const fields = [field, customObject.result[0].relationships[0].field];

      // Check if dedupe fields exists to change query params
      if (!isNullOrUndefined(dedupeFields)) {
        Object.keys(dedupeFields).forEach((field) => {
          fields.push(field);
        });
      }

      // Querying link leads in custom object
      const queryResult = await this.client.queryCustomObject(name, filterType, searchFields, fields);
      // Check if query ran as expected
      if (queryResult.success) {
        let filteredQueryResult = queryResult.result;

        // Check if filtered query has a result
        if (!filteredQueryResult.length) {
          return this.error('%s lead is not linked to %s', [linkValue, name]);
        }

        // Filter query by dedupeField
        if (!isNullOrUndefined(dedupeFields)) {
          for (const key in dedupeFields) {
            filteredQueryResult = filteredQueryResult.filter(result => dedupeFields[key] == result[key]);
          }
        }

        // Error if query retrieves more than one result
        if (filteredQueryResult.length > 1) {
          const headers = {};
          Object.keys(filteredQueryResult[0]).forEach(key => headers[key] = key);
          return this.error(
            'Error finding %s linked to %s: more than one matching custom object was found. Please provide dedupe field values to specify which object',
            [linkValue, name],
            [this.table('matchedObjects', `Matched ${customObject.result[0].displayName}`, headers, filteredQueryResult)],
          );
        }

        // Transform the value to `String`. However, cater for `null` or `undefined` by defaulting to `''` first
        const actualValue = String(filteredQueryResult[0][field] || '');

        // Field validation
        if (this.compare(operator, actualValue, expectedValue)) {
          return this.pass(
            this.operatorSuccessMessages[operator],
            [field, expectedValue || ''],
            [this.keyValue('customObject', `Checked ${customObject.result[0].displayName}`, filteredQueryResult[0])],
          );
        } else {
          return this.fail(
            this.operatorFailMessages[operator],
            [field, expectedValue || actualValue, actualValue],
            [this.keyValue('customObject', `Checked ${customObject.result[0].displayName}`, filteredQueryResult[0])]);
        }
      } else {
        return this.fail('Failed to query %s linked to %s.: %s', [
          name,
          linkValue,
          queryResult.result[0].reasons.map(reason => reason.message).join(', '),
        ]);
      }
    } catch (e) {
      return this.error('There was an error checking the %s Marketo Custom object: %s', [
        name,
        e.toString(),
      ]);
    }
  }

}

export { CustomObjectFieldEqualsStep as Step };
