/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition } from '../proto/cog_pb';

export class LeadFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on a Marketo Lead';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on marketo lead (?<email>.+) should be (?<expectation>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: "Lead's email address",
  }, {
    field: 'field',
    type: FieldDefinition.Type.STRING,
    description: 'Field name to check',
  }, {
    field: 'expectation',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'Expected field value',
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectation = stepData.expectation;
    const email = stepData.email;
    const field = stepData.field;

    try {
      const data: any = await this.client.findLeadByEmail(email, {
        fields: ['email', field].join(','),
      });

      if (data.success && data.result && data.result[0] && data.result[0].hasOwnProperty(field)) {
        // tslint:disable-next-line:triple-equals
        if (data.result[0][field] == expectation) {
          return this.pass('The %s field was %s, as expected.', [
            field,
            data.result[0][field],
          ]);
        } else {
          return this.fail('Expected %s to be %s, but it was actually %s.', [
            field,
            expectation,
            data.result[0][field],
          ]);
        }
      } else {
        if (data.result && data.result[0] && !data.result[0][field]) {
          return this.error('Found the %s lead, but there was no %s field.', [
            email,
            field,
            data,
          ]);
        } else {
          return this.error("Couldn't find a lead associated with %s", [
            email,
            data,
          ]);
        }
      }
    } catch (e) {
      return this.error('There was an error loading leads from Marketo: %s', [e.toString()]);
    }
  }

}

export { LeadFieldEqualsStep as Step };
