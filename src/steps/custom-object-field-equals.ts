import { isNullOrUndefined } from 'util';
/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class CustomObjectFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on a Marketo Custom Object';
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on the (?<name>.+) marketo custom object linked to lead (?<linkValue>.+) should (?<operator>be less than|be greater than|be|contain|not be|not contain) (?<expectedValue>.+)';
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
    description: 'Check Logic (be, not be, contain, not contain, be greater than, or be less than)',
  }, {
    field: 'expectedValue',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'The expected value of the field',
  }, {
    field: 'dedupeFields',
    type: FieldDefinition.Type.MAP,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'Map of custom dedupeFields data whose keys are field names.',
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const name = stepData.name;
    const linkValue = stepData.linkValue;
    const field = stepData.field;
    const operator = stepData.operator;
    const expectedValue = stepData.expectedValue;
    const dedupeFields = stepData.dedupeFields;

    try {
      const customObject = await this.client.getCustomObject(name);
      // Custom Object exists validation
      if (!customObject.result.length) {
        return this.error('Error finding %s: no such marketo custom object', [
          name,
        ]);
      }

      // Linked to lead validation
      if (!customObject.result[0].relationships.some(relationship => relationship.relatedTo.name == 'Lead')) {
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
      const lead = await this.client.findLeadByEmail(linkValue, {
        fields: ['email', linkField].join(','),
      });

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
      if (queryResult.success && queryResult.result.length > 0 && !queryResult.result[0].hasOwnProperty('reasons')) {
        let filteredQueryResult = queryResult.result;
        // Filter query by dedupeField
        if (!isNullOrUndefined(dedupeFields)) {
          for (const key in dedupeFields) {
            filteredQueryResult = filteredQueryResult.filter(result => dedupeFields[key] == result[key]);
          }
        }
        // Check if filtered query has a result
        if (!filteredQueryResult.length) {
          return this.error('%s lead is not linked to %s', [linkValue, name]);
        }
        // Error if query retrieves more than one result
        if (filteredQueryResult.length > 1) {
          const headers = {};
          Object.keys(filteredQueryResult[0]).forEach(key => headers[key] = key);
          const customObjectRecords = this.table('matchedObjects', `Checked ${name}`, headers, filteredQueryResult);
          return this.error('Error finding %s linked to %s: more than one matching custom object was found. Please provide dedupe field values to specify which object', [
            linkValue,
            name,
          ],                [customObjectRecords]);
        }

        const customObjectRecord = this.keyValue('customObject', `Checked ${name}`, filteredQueryResult[0]);
        // Field validation
        if (this.compare(operator, String(filteredQueryResult[0][field]), expectedValue)) {
          return this.pass(this.operatorSuccessMessages[operator], [field, expectedValue], [customObjectRecord]);
        } else {
          return this.fail(this.operatorFailMessages[operator], [
            field,
            expectedValue,
            String(filteredQueryResult[0][field]),
          ],               [customObjectRecord]);
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
