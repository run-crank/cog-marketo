/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition } from '../proto/cog_pb';
import { isNullOrUndefined } from 'util';

export class DeleteCustomObjectStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Delete a Marketo Custom Object';
  protected stepExpression: string = 'delete the (?<name>.+) marketo custom object linked to lead (?<linkValue>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'name',
    type: FieldDefinition.Type.STRING,
    description: "Custom Object's API name",
  }, {
    field: 'linkValue',
    type: FieldDefinition.Type.EMAIL,
    description: "Linked Lead's email address",
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
    const dedupeFields = stepData.dedupeFields;

    try {
      const customObject = await this.client.getCustomObject(name);

      // Custom Object exists validation
      if (!customObject.result.length) {
        return this.error('Error deleting %s: no such marketo custom object', [
          name,
        ]);
      }

      // Linked to lead validation
      if (!customObject.result[0].relationships.some(relationship => relationship.relatedTo.name == 'Lead')) {
        return this.error("Error deleting %s linked to %s: this custom object isn't linked to leads", [
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

      if (!lead.result.length) {
        return this.error('Error deleting %s: the %s lead does not exist.', [name, linkValue]);
      }

      // Assign Query Params
      const searchFields = [{ [customObject.result[0].relationships[0].field]: lead.result[0][linkField] }];
      const filterType = customObject.result[0].relationships[0].field;
      const fields = [customObject.result[0].idField];

      // Check if dedupe fields exists to change query params
      if (!isNullOrUndefined(dedupeFields)) {
        Object.keys(dedupeFields).forEach((field) => {
          fields.push(field);
        });
      }

      // Querying link leads in custom object
      const queryResult = await this.client.queryCustomObject(name, filterType, searchFields, fields);

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
          return this.error('Error deleting %s linked to %s: more than one matching custom object was found. Please provide dedupe field values to specify which object', [
            linkValue,
            name,
          ]);
        }

        // Delete using idField from customObject and its value from queried link
        const data = await this.client.deleteCustomObjectById(name, queryResult.result[0][customObject.result[0].idField]);
        if (data.success && data.result.length > 0 && data.result[0].status != 'skipped') {
          return this.pass('Successfully deleted %s linked to %s.', [linkValue, name]);
        } else {
          return this.fail('Failed to delete %s.: %s', [
            name,
            data.result[0].reasons[0].message,
          ]);
        }
      } else {
        return this.fail('Error deleting %s: Failed to query %s linked to %s to be deleted: %s', [
          name,
          name,
          linkValue,
          queryResult.result[0].reasons.map(reason => reason.message).join(', '),
        ]);
      }
    } catch (e) {
      return this.error('Error deleting %s: %s', [
        name,
        e.toString(),
      ]);
    }
  }

}

export { DeleteCustomObjectStep as Step };
