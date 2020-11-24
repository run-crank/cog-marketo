/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';
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
  }, {
    field: 'partitionId',
    type: FieldDefinition.Type.NUMERIC,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'ID of partition lead belongs to',
    help: 'Only necessary to provide if Marketo has been configured to allow duplicate leads by email.',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'customObject',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'marketoGUID',
      type: FieldDefinition.Type.STRING,
      description: "Custom Object's Marketo GUID",
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const name = stepData.name;
    const linkValue = stepData.linkValue;
    const dedupeFields = stepData.dedupeFields;
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;

    try {
      const customObject = await this.client.getCustomObject(name);

      // Custom Object exists validation
      if (!customObject.result.length) {
        return this.fail('Error deleting %s: no such marketo custom object', [
          name,
        ]);
      }

      // Linked to lead validation
      if (!customObject.result[0].relationships || !customObject.result[0].relationships.some(relationship => relationship.relatedTo.name == 'Lead')) {
        return this.fail("Error deleting %s linked to %s: this custom object isn't linked to leads", [
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
      const lead = await this.client.findLeadByEmail(linkValue, { fields: ['email', linkField].join(',') }, partitionId);

      if (!lead.result.length) {
        return this.fail('Error deleting %s: the %s lead does not exist%s.', [
          name,
          linkValue,
          partitionId ? ` in partition ${partitionId}` : '',
        ]);
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

      if (queryResult.success) {
        let filteredQueryResult = queryResult.result;

        // Check if filtered query has a result
        if (!filteredQueryResult.length) {
          return this.fail('%s lead is not linked to %s', [linkValue, name]);
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
          return this.fail(
            'Error deleting %s linked to %s: more than one matching custom object was found. Please provide dedupe field values to specify which object',
            [linkValue, name],
            [this.table('matchedObjects', `Matched ${customObject.result[0].displayName}`, headers, filteredQueryResult)]);
        }

        // Delete using idField from customObject and its value from queried link
        const data = await this.client.deleteCustomObjectById(name, filteredQueryResult[0][customObject.result[0].idField]);
        if (data.success && data.result.length > 0 && data.result[0].status != 'skipped') {
          const custObjRecord = this.keyValue('customObject', `Deleted ${customObject.result[0].displayName}`, {
            marketoGUID: data.result[0].marketoGUID,
          });
          return this.pass('Successfully deleted %s linked to %s.', [linkValue, name], [custObjRecord]);
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
          queryResult.errors.map(e => e.message).join(',\n\n'),
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
