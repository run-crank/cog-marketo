import { isNullOrUndefined } from 'util';
/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../proto/cog_pb';

export class CreateOrUpdateCustomObjectStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Create or update a Marketo custom object';
  protected stepExpression: string = 'create or update an? (?<name>.+) marketo custom object linked to lead (?<linkValue>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = ['create', 'update'];
  protected targetObject: string = 'Custom Object';
  protected expectedFields: Field[] = [{
    field: 'name',
    type: FieldDefinition.Type.STRING,
    description: "Custom Object's API name",
  }, {
    field: 'linkValue',
    type: FieldDefinition.Type.EMAIL,
    description: "Linked Lead's email address",
  }, {
    field: 'customObject',
    type: FieldDefinition.Type.MAP,
    description: 'Map of custom object data whose keys are field names.',
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
    const object = stepData.customObject;
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;

    try {
      const customObject = await this.client.getCustomObject(name, linkValue);
      // Custom Object exists validation
      if (!customObject.result.length) {
        return this.fail('Error creating or updating %s: no such marketo custom object', [
          name,
        ]);
      }

      // Linked to lead validation
      if (!customObject.result[0].relationships || !customObject.result[0].relationships.some(relationship => relationship.relatedTo.name == 'Lead')) {
        return this.fail("Error creating or updating %s linked to %s: this custom object isn't linked to leads", [
          name,
          linkValue,
        ]);
      }
      // DedupeField related validations
      if (customObject.result[0].hasOwnProperty('dedupeFields') && customObject.result[0].dedupeFields.length > 0) {
        const missingDedupeFields = [];
        customObject.result[0].dedupeFields.forEach((dedupefield) => {
          if (!object.hasOwnProperty(dedupefield)) {
            let fieldLabel;
            customObject.result[0].fields.find((field) => {
              if (dedupefield != customObject.result[0].relationships[0].field && field.name == dedupefield) {
                fieldLabel = field.displayName;
                missingDedupeFields.push(fieldLabel.concat(`(${dedupefield})`));
              }
            });
          }
        });

        // Missing dedupe fields validation
        if (missingDedupeFields.length > 0) {
          return this.error('Error creating or updating %s: you must provide values for the following fields: %s', [
            name,
            missingDedupeFields.join(', '),
          ]);
        }
      }
      // @todo Remove describe related linkField value assignement code once marketo custom object bug is fixed
      // Getting of api name of field if relateTo field is Display Name
      const leadDescribe = await this.client.describeLeadFields(linkValue);
      const linkField = leadDescribe.result.find(field => field.displayName == customObject.result[0].relationships[0].relatedTo.field)
                       ?  leadDescribe.result.find(field => field.displayName == customObject.result[0].relationships[0].relatedTo.field).rest.name
                       : customObject.result[0].relationships[0].relatedTo.field;

      // Getting link field value from lead
      const lead = await this.client.findLeadByEmail(linkValue, { fields: ['email', linkField].join(',') }, partitionId);

      // Check if leads are retrieved
      if (!lead.result.length) {
        return this.fail("Error creating or updating %s: can't link object to %s, who does not exist%s.", [
          name,
          linkValue,
          partitionId ? ` in partition ${partitionId}` : '',
        ]);
      }

      // Check if LinkField has value
      if (isNullOrUndefined(lead.result[0][linkField])) {
        return this.error("Error creating or updating %s: can't link object to %s, whose %s link field is null or undefined.", [name, linkValue, linkField]);
      }
      // Assign link field value to custom object to be created
      object[customObject.result[0].relationships[0].field] = lead.result[0][linkField];
      const data = await this.client.createOrUpdateCustomObject(name, object);
      if (data.success && data.result.length > 0 && data.result[0].status != 'skipped') {
        const custObjRecord = this.createRecord(data);
        const orderedCustObjRecord = this.createOrderedRecord(data, stepData['__stepOrder']);
        return this.pass(`Successfully ${data.result[0].status} %s`, [name], [custObjRecord, orderedCustObjRecord]);
      } else {
        return this.fail('Failed to create %s.: %s', [
          name,
          data.result[0].reasons[0].message,
        ]);
      }
    } catch (e) {
      return this.error('Error creating or updating %s: %s', [
        name,
        e.toString(),
      ]);
    }
  }

  public createRecord(customObject): StepRecord {
    return this.keyValue('customObject', `Created ${customObject.result[0].displayName}`, {
      marketoGUID: customObject.result[0].marketoGUID,
    });
  }

  public createOrderedRecord(customObject, stepOrder = 1): StepRecord {
    return this.keyValue(`customObject.${stepOrder}`, `Created ${customObject.result[0].displayName} from Step ${stepOrder}`, {
      marketoGUID: customObject.result[0].marketoGUID,
    });
  }

}

export { CreateOrUpdateCustomObjectStep as Step };
