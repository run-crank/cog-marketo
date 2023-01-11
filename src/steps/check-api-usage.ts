/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class CheckApiUsageStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check daily Marketo API usage';
  protected stepExpression: string = 'there should be less than 90% usage of your daily API limit';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected actionList: string[] = ['check'];
  protected targetObject: string = 'API Usage';
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
      const dailyUsageArray = (await this.client.getDailyApiUsage()).result;
      const dailyUsage = dailyUsageArray.map(record => record.total).reduce((a, b) => a + b, 0);
      const percentUsage = (dailyUsage / requestLimit) * 100;

      const weeklyUsageArray = (await this.client.getWeeklyApiUsage()).result;
      const weeklyUsage = weeklyUsageArray.map(record => record.total).reduce((a, b) => a + b, 0);
      const weeklyUsagePerDay = weeklyUsage / 7;
      const comparison = dailyUsage > weeklyUsagePerDay ? 'greater' : 'less';

      if (dailyUsage < (0.9 * requestLimit)) {
        return this.pass('You have used %d of your %d API calls for today, which is %d%% of your daily API limit. In the past week, you have used %d API calls which averages out to be %d per day. Today’s API calls are %s than your trailing 7 day average.',
                         [dailyUsage, requestLimit, percentUsage, weeklyUsage, weeklyUsagePerDay, comparison],
                         [this.keyValue('requests', 'Checked API Usage', { apiUsage: dailyUsage })]);
      }
      return this.fail('You have used %d of your %d API calls for today, which is %d%% of your daily API limit. In the past week, you have used %d API calls which averages out to be %d per day. Today’s API calls are %s than your trailing 7 day average.',
                       [dailyUsage, requestLimit, percentUsage, weeklyUsage, weeklyUsagePerDay, comparison],
                       [this.keyValue('requests', 'Checked API Usage', { apiUsage: dailyUsage })]);
    } catch (e) {
      return this.error('There was a problem checking the API Usage: %s', [e.toString()]);
    }
  }
}

export { CheckApiUsageStep as Step };
