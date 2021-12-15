/*tslint:disable:no-else-after-return*/

import moment = require('moment');
import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../../proto/cog_pb';

export class CreateProgramCostStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Create Cost for Marketo Program Cost';
  protected stepExpression: string = 'create cost for marketo program';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [
    {
      field: 'name',
      type: FieldDefinition.Type.STRING,
      description: "Program's Name",
    },
    {
      field: 'startDate',
      type: FieldDefinition.Type.DATE,
      description: 'Period Month',
    },
    {
      field: 'cost',
      type: FieldDefinition.Type.NUMERIC,
      description: 'Period Cost(USD)',
    },
    {
      field: 'note',
      type: FieldDefinition.Type.STRING,
      description: 'Note',
    },
    {
      field: 'costsDestructiveUpdate ',
      type: FieldDefinition.Type.BOOLEAN,
      optionality: FieldDefinition.Optionality.OPTIONAL,
      description: 'Clear existing costs before creating?',
    },
  ];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'program',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Program's Marketo ID",
    }],
    dynamicFields: false,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const name = stepData.name;
    const startDate = stepData.startDate;
    const cost = stepData.cost;
    const note = stepData.note;
    const costsDestructiveUpdate = stepData.costsDestructiveUpdate;
    try {
      let data;
      let program = `costs=[{"startDate":"${moment(startDate).format('YYYY-MM-DD')}","cost":${cost},"note":"${note}"}]`;
      if (costsDestructiveUpdate) {
        program += '&costsDestructiveUpdate=true';
      }

      const filteredProgram: any = await this.client.findProgramsByName(name);
      if (filteredProgram.success && filteredProgram.result && filteredProgram.result[0] && filteredProgram.result[0].id) {
        data = await this.client.updateProgram(filteredProgram.result[0].id, program);
      }

      if (data.success && data.result && data.result[0] && data.result[0].status !== 'skipped') {
        return this.pass(
          'Successfully updated program %s',
          [name],
          [this.keyValue('program', 'Updated Program', { id: data.result[0].id })],
        );
      } else {
        if (data.result && data.result[0] && data.result[0].reasons && data.result[0].reasons[0]) {
          return this.fail('Unable to update program: %s', [
            data.result[0].reasons[0].message,
          ]);
        } else {
          return this.fail('Unable to update program: %s', [
            `status was ${data.result[0].status}`,
          ]);
        }
      }
    } catch (e) {
      return this.error('There was an error updating program cost in Marketo: %s', [
        e.toString(),
      ]);
    }
  }

}

export { CreateProgramCostStep as Step };
