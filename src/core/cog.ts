import * as grpc from 'grpc';
import { Struct, Value } from 'google-protobuf/google/protobuf/struct_pb';
import * as fs from 'fs';

import { Field, StepInterface } from './base-step';

import { ICogServiceServer } from '../proto/cog_grpc_pb';
import { ManifestRequest, CogManifest, Step, RunStepRequest, RunStepResponse, FieldDefinition,
  StepDefinition } from '../proto/cog_pb';

export class Cog implements ICogServiceServer {

  private cogName: string = 'automatoninc/marketo';
  private cogVersion: string = JSON.parse(fs.readFileSync('package.json').toString('utf8')).version;
  private authFields: Field[] = [{
    field: 'endpoint',
    type: FieldDefinition.Type.STRING,
    description: 'Marketo REST API domain (without /rest), e.g. https://abc-123-xyz.mktorest.com',
  }, {
    field: 'clientId',
    type: FieldDefinition.Type.STRING,
    description: 'The Client ID associated with your Marketo Web Service.',
  }, {
    field: 'clientSecret',
    type: FieldDefinition.Type.STRING,
    description: 'The Client Secret associated with your Marketo Web Service.',
  }];

  private steps: StepInterface[];

  constructor (private marketoClientClass, private stepMap: any = {}) {
    this.steps = fs.readdirSync(`${__dirname}/../steps`, { withFileTypes: true })
      .filter((file: fs.Dirent) => {
        return file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.js'));
      }).map((file: fs.Dirent) => {
        const step = require(`${__dirname}/../steps/${file.name}`).Step;
        const stepInstance: StepInterface = new step(this.marketoClientClass);
        this.stepMap[stepInstance.getId()] = step;
        return stepInstance;
      });
  }

  getManifest(
    call: grpc.ServerUnaryCall<ManifestRequest>,
    callback: grpc.sendUnaryData<CogManifest>,
  ) {
    const manifest: CogManifest = new CogManifest();
    const stepDefinitions: StepDefinition[] = this.steps.map((step: StepInterface) => {
      return step.getDefinition();
    });

    manifest.setName(this.cogName);
    manifest.setVersion(this.cogVersion);
    manifest.setStepDefinitionsList(stepDefinitions);

    this.authFields.forEach((field: Field) => {
      const authField: FieldDefinition = new FieldDefinition();
      authField.setKey(field.field);
      authField.setOptionality(FieldDefinition.Optionality.REQUIRED);
      authField.setType(field.type);
      authField.setDescription(field.description);
      manifest.addAuthFields(authField);
    });

    callback(null, manifest);
  }

  runSteps(call: grpc.ServerDuplexStream<RunStepRequest, RunStepResponse>) {
    let processing = 0;
    let clientEnded = false;

    call.on('data', async (runStepRequest: RunStepRequest) => {
      processing = processing + 1;

      const step: Step = runStepRequest.getStep();
      const response: RunStepResponse = await this.dispatchStep(step, call.metadata);
      call.write(response);

      processing = processing - 1;

      // If this was the last step to process and the client has ended the
      // stream, then end our stream as well.
      if (processing === 0 && clientEnded) {
        call.end();
      }
    });

    call.on('end', () => {
      clientEnded = true;

      // Only end the stream if we are done processing all steps.
      if (processing === 0) {
        call.end();
      }
    });
  }

  async runStep(
    call: grpc.ServerUnaryCall<RunStepRequest>,
    callback: grpc.sendUnaryData<RunStepResponse>,
  ) {
    const step: Step = call.request.getStep();
    const response: RunStepResponse = await this.dispatchStep(step, call.metadata);
    callback(null, response);
  }

  private async dispatchStep(step: Step, metadata: grpc.Metadata): Promise<RunStepResponse> {
    const marketo = this.getMarketoClient(metadata);
    const stepId = step.getStepId();
    let response: RunStepResponse = new RunStepResponse();

    if (!this.stepMap.hasOwnProperty(stepId)) {
      response.setOutcome(RunStepResponse.Outcome.ERROR);
      response.setMessageFormat('Unknown step %s');
      response.addMessageArgs(Value.fromJavaScript(stepId));
      return response;
    }

    try {
      const stepExecutor: StepInterface = new this.stepMap[stepId](marketo);
      response = await stepExecutor.executeStep(step);
    } catch (e) {
      response.setOutcome(RunStepResponse.Outcome.ERROR);
      response.setResponseData(Struct.fromJavaScript(e));
    }

    return response;
  }

  private getMarketoClient(auth: grpc.Metadata) {
    return new this.marketoClientClass({
      endpoint: `${auth.get('endpoint')[0]}/rest`,
      identity: `${auth.get('endpoint')[0]}/identity`,
      clientId: auth.get('clientId')[0],
      clientSecret: auth.get('clientSecret')[0],
    });
  }

}
