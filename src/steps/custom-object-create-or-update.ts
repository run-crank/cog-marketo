/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition } from '../proto/cog_pb';

export class CreateOrUpdateCustomObjectStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Create or Update a Marketo Custom Object';
  protected stepExpression: string = 'create or update an? (?<name>.+) marketo custom object linked to lead (?<linkValue>.+)';
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
    field: 'object',
    type: FieldDefinition.Type.MAP,
    description: 'Map of custom object data whose keys are field names.',
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const name = stepData.name;
    const linkValue = stepData.linkValue;
    const object = stepData.object;

    try {
      const customObject = await this.client.getCustomObject(name);
      // Custom Object exists validation
      if (!customObject.result.length) {
        return this.error('Error creating or updating %s: no such marketo custom object', [
          name,
        ]);
      }

      // Linked to lead validation
      if (!customObject.result[0].relationships.some(relationship => relationship.relatedTo.name == 'Lead')) {
        return this.error("Error creating or updating %s linked to %s: this custom object isn't linked to leads", [
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
          return this.error('Error creating or updating %s: you must provide values for the the following fields: %s', [
            name,
            missingDedupeFields.join(', '),
          ]);
        }
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
        return this.error("Error creating or updating %s: can't link object to %s, who does not exist.", [name, linkValue]);
      }

      // Assign link field value to custom object to be created
      object[customObject.result[0].relationships[0].field] = lead.result[0][linkField];
      const data = await this.client.createOrUpdateCustomObject(name, object);
      if (data.success && data.result.length > 0) {
        return this.pass('Successfully created %s.', [name]);
      } else {
        return this.fail('Failed to create %s.: %s', [
          name,
          data.errors[0].message,
        ]);
      }
    } catch (e) {
      return this.error('Error creating or updating %s: %s', [
        name,
        e.toString(),
      ]);
    }
  }

}

export { CreateOrUpdateCustomObjectStep as Step };
