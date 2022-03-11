/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition } from '../proto/cog_pb';

export class SendSampleEmailStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Send Sample Email';
  protected stepExpression: string = 'send a sample email to (?<emailAddress>.+\@.+\..+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [
    {
      field: 'workspace',
      type: FieldDefinition.Type.STRING,
      optionality: FieldDefinition.Optionality.OPTIONAL,
      description: 'Name of the workspace that contains the Marketo email asset',
    },
    {
      field: 'program',
      type: FieldDefinition.Type.STRING,
      optionality: FieldDefinition.Optionality.OPTIONAL,
      description: 'Program Name',
    },
    {
      field: 'emailAsset',
      type: FieldDefinition.Type.ANYSCALAR,
      description: 'Marketo email asset name or numeric id',
    },
    {
      field: 'emailAddress',
      type: FieldDefinition.Type.EMAIL,
      description: 'Recipient\'s email address',
    },
  ];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'email',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Email's Marketo ID",
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData().toJavaScript();
    const workspace: string = stepData.workspace || null;
    const program = stepData.program || null;
    const emailAsset = stepData.emailAsset;
    const emailAddress = stepData.emailAddress;
    const isEmailAssetIdProvided = !isNaN(emailAsset);
    const records = [];

    try {
      if (isEmailAssetIdProvided) {
        // If the email Id is provided, send the email
        const emailSent: any = await this.client.sendSampleEmail(emailAsset, emailAddress);
        if (emailSent && emailSent.success && emailSent.result && emailSent.result[0]) {
          return this.pass('Successfully sent Marketo email with id %d to %s', [emailAsset, emailAddress]);
        } else {
          return this.error('There was an error sending the Marketo email with id %d', [emailAsset]);
        }
      } else {
        // If the email name is provided, then get a list of all emails and filter them
        let matchingEmails: any = await this.client.getEmails();

        if (workspace) {
          const matchingWorkspaceEmails = matchingEmails.filter(e => e.workspace && e.workspace.toLowerCase() == workspace.toLowerCase());
          matchingEmails = matchingWorkspaceEmails;
        }

        if (program) {
          const matchingProgramEmails = matchingEmails.filter(e => e.folder && e.folder.folderName.toLowerCase() == program.toLowerCase());
          matchingEmails = matchingProgramEmails;
        }

        const matchingNameEmails = matchingEmails.filter(e => e.name && e.name.toLowerCase() == emailAsset.toLowerCase());
        matchingEmails = matchingNameEmails;

        if (matchingEmails.length === 1) {
          const emailSent: any = await this.client.sendSampleEmail(matchingEmails[0].id, emailAddress);
          const emailRecord = this.keyValue('email', 'Email Record', matchingEmails[0]);
          if (emailSent && emailSent.success && emailSent.result && emailSent.result[0]) {
            return this.pass('Successfully sent Marketo email with id %d to %s', [emailAsset, emailAddress], [emailRecord]);
          } else {
            return this.error('There was an error sending the Marketo email', [], [emailRecord]);
          }
        } else if (matchingEmails.length === 0) {
          return this.error('No Marketo emails match your criteria: found %d matching emails', [matchingEmails.length]);
        } else {
          matchingEmails.forEach((email, index) => {
            const emailRecord = this.keyValue(`email ${index}`, 'Email Record', email);
            records.push(emailRecord);
          });
          return this.error('Multiple Marketo emails match your criteria: found %d matching emails', [matchingEmails.length], records);
        }
      }
    } catch (e) {
      console.log(e);
      return this.error('There was an error sending the Marketo email: %s', [
        e.toString(),
      ]);
    }
  }
}

export { SendSampleEmailStep as Step };
