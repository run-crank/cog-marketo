/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition } from '../proto/cog_pb';

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

      // Querying link leads in custom object
      const searchFields = {};
      searchFields[customObject.result[0].relationships[0].field] = lead.result[0][linkField];
      const queryResult = await this.client.queryCustomObject(name, customObject.result[0].relationships[0].field, [searchFields], [customObject.result[0].idField]);

      // Error if query retrieves more than one result
      if (queryResult.result.length > 1) {
        return this.error('Error deleting %s linked to %s: more than one matching custom object was found. Please provide dedupe field values to specify which object', [
          linkValue,
          name,
        ]);
      }

      // Delete using idField from customObject and its value from queried link
      const data = await this.client.deleteCustomObjectById(name, queryResult.result[0][customObject.result[0].idField]);
      if (data.success && data.result.length) {
        return this.pass('Successfully deleted %s linked to %s.', [linkValue, name]);
      } else {
        return this.fail('Failed to deleted %s.: %s', [
          name,
          data.errors[0].message,
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
