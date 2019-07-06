import { BaseStep, Field, StepInterface } from '../base-step';
import { Step, RunStepResponse, FieldDefinition } from '../proto/cog_pb';
import { Struct, Value } from 'google-protobuf/google/protobuf/struct_pb';

export class CreateOrUpdateLeadByFieldStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Create or Update Marketo Lead';
  protected stepExpression: string = 'create or update a marketo lead';
  protected expectedFields: Field[] = [{
    field: 'lead',
    type: FieldDefinition.Type.MAP,
    description: 'Key/value pairs whose keys correspond to Marketo REST API field names for ' +
      'Lead fields. Must include an email key/value pair.',
  }];

  async executeStep(step: Step) {
    let responseData: Struct;
    const stepData: any = step.getData().toJavaScript();
    const lead = stepData.lead;
    const response = new RunStepResponse();

    try {
      const data: any = await this.marketo.lead.createOrUpdate([lead], { lookupField: 'email' });
      if (data.success && data.result && data.result[0] && data.result[0].status !== 'skipped') {
        response.setOutcome(RunStepResponse.Outcome.PASSED);
        response.setMessageFormat('Successfully created or updated lead %s with status %s');
        response.addMessageArgs(Value.fromJavaScript(lead.email));
        response.addMessageArgs(Value.fromJavaScript(data.result[0].status));
      } else {
        response.setOutcome(RunStepResponse.Outcome.FAILED);
        response.setMessageFormat('Unable to create or update lead: %s');
        if (data.result && data.result[0] && data.result[0].reasons && data.result[0].reasons[0]) {
          response.addMessageArgs(Value.fromJavaScript(data.result[0].reasons[0].message));
        } else {
          response.addMessageArgs(Value.fromJavaScript(`status was ${data.result[0].status}`));
        }
      }
      responseData = Struct.fromJavaScript(data.result[0]);
    } catch (e) {
      responseData = Struct.fromJavaScript(e);
      response.setOutcome(RunStepResponse.Outcome.ERROR);
      response.setMessageFormat('There was an error creating or updating leads in Marketo: %s');
      response.addMessageArgs(Value.fromJavaScript(e.message));
    }

    response.setResponseData(responseData);
    return response;
  }

}

export { CreateOrUpdateLeadByFieldStep as Step };
