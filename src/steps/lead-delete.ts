import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, RunStepResponse, FieldDefinition, StepDefinition } from '../proto/cog_pb';
import { Struct, Value } from 'google-protobuf/google/protobuf/struct_pb';

export class DeleteLeadStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Delete Marketo Lead';
  protected stepExpression: string = 'delete the (?<email>.+) marketo lead';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: 'The email address of the Marketo lead to be deleted.',
  }];

  async executeStep(step: Step) {
    let responseData: Struct;
    const stepData: any = step.getData().toJavaScript();
    const email = stepData.email;
    const res = new RunStepResponse();

    try {
      const data: any = await this.client.findLeadByEmail(email);

      if (data.success && data.result && data.result[0] && data.result[0].id) {
        const deleteRes: any = await this.client.deleteLeadById(data.result[0].id);

        if (
          deleteRes.success &&
          deleteRes.result &&
          deleteRes.result[0] &&
          deleteRes.result[0].status === 'deleted'
        ) {
          res.setOutcome(RunStepResponse.Outcome.PASSED);
          res.setMessageFormat('Successfully deleted lead %s');
          res.addMessageArgs(Value.fromJavaScript(email));
        } else {
          res.setOutcome(RunStepResponse.Outcome.FAILED);
          res.setMessageFormat('Unable to delete lead %s: %s');
          res.addMessageArgs(Value.fromJavaScript(email));
          res.addMessageArgs(Value.fromJavaScript(data));
        }
        responseData = Struct.fromJavaScript(deleteRes.result[0]);
      } else {
        res.setOutcome(RunStepResponse.Outcome.ERROR);
        res.setMessageFormat('Unable to delete lead %s: %s');
        res.addMessageArgs(Value.fromJavaScript(email));
        res.addMessageArgs(Value.fromJavaScript('a lead with that email address does not exist.'));
        responseData = Struct.fromJavaScript(data);
      }
    } catch (e) {
      responseData = Struct.fromJavaScript(e);
      res.setOutcome(RunStepResponse.Outcome.ERROR);
      res.setMessageFormat('There was an error deleting %s from Marketo: %s');
      res.addMessageArgs(Value.fromJavaScript(email));
      res.addMessageArgs(Value.fromJavaScript(e.message));
    }

    res.setResponseData(responseData);
    return res;
  }

}

export { DeleteLeadStep as Step };
