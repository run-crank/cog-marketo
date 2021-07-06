/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class CheckApiUsageStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check daily Marketo API usage';
  protected stepExpression: string = 'there should be less than 90% usage of your daily API limit';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'requestLimit',
    type: FieldDefinition.Type.NUMERIC,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'Your daily API request limit',
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'requests',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'apiUsage',
      type: FieldDefinition.Type.NUMERIC,
      description: 'Daily API Requests',
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const requestLimit = stepData.requestLimit || 50000;

    try {
      const usage = (await this.client.getDailyApiUsage()).result;

      if (!usage && usage !== []) {
        return this.fail('Api Usage was not found');
      }

      const dailyUsage = usage.map(record => record.total).reduce((a, b) => a + b, 0);

      if (dailyUsage < (0.9 * requestLimit)) {
        return this.pass('Your daily usage is %d, which is less than 90%% of your daily limit of %d.',
                         [dailyUsage, requestLimit],
                         [this.keyValue('requests', 'Checked API Usage', { apiUsage: dailyUsage })]);
      } else {
        return this.fail('Your daily usage is %d, which is more than 90%% of your daily limit of %d.',
                         [dailyUsage, requestLimit],
                         [this.keyValue('requests', 'Checked API Usage', { apiUsage: dailyUsage })]);
      }
    } catch (e) {
      return this.error('There was a problem checking the API Usage: %s', [e.toString()]);
    }
  }
}

export { CheckApiUsageStep as Step };
