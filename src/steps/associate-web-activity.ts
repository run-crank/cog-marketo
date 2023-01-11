/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class AssociateWebActivityStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Associate web activity';
  protected stepExpression: string = 'associate web activity with munchkin cookie (?<munchkinCookie>.+) to marketo lead (?<email>.+\@.+\..+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected actionList: string[] = ['add'];
  protected targetObject: string = 'Web Activity to Lead';
  protected expectedFields: Field[] = [
    {
      field: 'munchkinCookie',
      type: FieldDefinition.Type.STRING,
      description: 'Value of _mkto_trk cookie in browser',
    },
    {
      field: 'email',
      type: FieldDefinition.Type.STRING,
      description: 'Lead\'s email address or id',
    },
    {
      field: 'partitionId',
      type: FieldDefinition.Type.NUMERIC,
      optionality: FieldDefinition.Optionality.OPTIONAL,
      description: 'ID of partition lead belongs to',
      help: 'Only necessary to provide if Marketo has been configured to allow duplicate leads by email.',
    },
  ];
  protected expectedRecords: ExpectedRecord[] = [];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const munchkinCookie = stepData.munchkinCookie;
    const reference = stepData.email;
    const partitionId: number = stepData.partitionId ? parseFloat(stepData.partitionId) : null;

    try {
      const emailRegex = /(.+)@(.+){2,}\.(.+){2,}/;
      let lookupField = 'id';
      if (emailRegex.test(reference)) {
        lookupField = 'email';
      }

      const data: any = await this.client.findLeadByField(lookupField, reference, 'id', partitionId);

      if (data.success && data.result && data.result[0] && data.result[0].hasOwnProperty('id')) {
        const associate: any = await this.client.associateLeadById(data.result[0].id, munchkinCookie);

        if (associate.success && associate.requestId) {
          return this.pass('Successfully associated munchkin cookie %s with Marketo lead %s', [munchkinCookie, reference]);
        } else {
          return this.error('Unable to assocated munchkin cookie %s with Marketo lead %s', [munchkinCookie, reference]);
        }
      } else {
        return this.error("Couldn't find a lead associated with %s%s", [
          reference,
          partitionId ? ` in partition ${partitionId}` : '',
        ]);
      }
    } catch (e) {
      console.log(e);
      return this.error('There was an error associating the munchkin cookie with the Marketo lead: %s', [
        e.toString(),
      ]);
    }
  }
}

export { AssociateWebActivityStep as Step };
