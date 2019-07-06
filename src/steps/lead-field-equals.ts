import { BaseStep, Field, StepInterface } from '../base-step';
import { Step, RunStepResponse, FieldDefinition } from '../proto/cog_pb';
import { Struct, Value } from 'google-protobuf/google/protobuf/struct_pb';

export class LeadFieldEqualsStep extends BaseStep implements StepInterface {

  protected stepName: string = 'Check Marketo Lead Field for Value';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_-]+) field on (?<email>.+) should equal (?<expectation>.+) in marketo';
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: 'The email address of the Marketo lead to inspect.',
  }, {
    field: 'field',
    type: FieldDefinition.Type.STRING,
    description: 'The REST API field name of the Lead field to inspect.',
  }, {
    field: 'expectation',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'The expected field value.',
  }];

  async executeStep(step: Step) {
    let responseData: Struct;
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectation = stepData.expectation;
    const email = stepData.email;
    const field = stepData.field;
    const response = new RunStepResponse();

    try {
      const data: any = await this.marketo.lead.find('email', [email], {
        fields: ['email', field].join(','),
      });

      if (data.success && data.result && data.result[0] && data.result[0][field]) {
        // tslint:disable-next-line:triple-equals
        if (data.result[0][field] == expectation) {
          response.setOutcome(RunStepResponse.Outcome.PASSED);
          response.setMessageFormat('The %s field was %s, as expected.');
          response.addMessageArgs(Value.fromJavaScript(field));
          response.addMessageArgs(Value.fromJavaScript(data.result[0][field]));
        } else {
          response.setOutcome(RunStepResponse.Outcome.FAILED);
          response.setMessageFormat('Expected %s to be %s, but it was actually %s.');
          response.addMessageArgs(Value.fromJavaScript(field));
          response.addMessageArgs(Value.fromJavaScript(expectation));
          response.addMessageArgs(Value.fromJavaScript(data.result[0][field]));
        }
        responseData = Struct.fromJavaScript(data.result[0]);
      } else {
        response.setOutcome(RunStepResponse.Outcome.ERROR);
        response.setMessageFormat("Couldn't find a lead associated with %s");
        response.addMessageArgs(Value.fromJavaScript(email));
        responseData = Struct.fromJavaScript(data);
      }
    } catch (e) {
      responseData = Struct.fromJavaScript(e);
      response.setOutcome(RunStepResponse.Outcome.ERROR);
      response.setMessageFormat('There was an error loading leads from Marketo: %s');
      response.addMessageArgs(Value.fromJavaScript(e.message));
    }

    response.setResponseData(responseData);
    return response;
  }

}

export { LeadFieldEqualsStep as Step };
