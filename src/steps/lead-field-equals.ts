/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition } from '../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../client/constants/operators';

export class LeadFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on a Marketo Lead';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on marketo lead (?<email>.+) should (?<operator>be less than|be greater than|be|contain|not be|not contain) (?<expectation>.+)';
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
    field: 'operator',
    type: FieldDefinition.Type.STRING,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'Check Logic (be, not be, contain, not contain, be greater than, or be less than)',
  }, {
    field: 'expectation',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'Expected field value',
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectation = stepData.expectation;
    const email = stepData.email;
    const operator: string = stepData.operator || 'be';
    const field = stepData.field;

    try {
      const data: any = await this.client.findLeadByEmail(email, {
        fields: ['email', field].join(','),
      });

      if (data.success && data.result && data.result[0] && data.result[0].hasOwnProperty(field)) {
        if (this.compare(operator, data.result[0][field], expectation)) {
          return this.pass(this.operatorSuccessMessages[operator], [field, expectation]);
        } else {
          return this.fail(this.operatorFailMessages[operator], [
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
      if (e instanceof util.UnknownOperatorError) {
        return this.error('%s Please provide one of: %s', [e.message, baseOperators.join(', ')]);
      }
      if (e instanceof util.InvalidOperandError) {
        return this.error(e.message);
      }
      return this.error('There was an error during validation of lead field: %s', [e.message]);
    }
  }

}

export { LeadFieldEqualsStep as Step };
