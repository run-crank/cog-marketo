import * as grpc from 'grpc';
import { Struct, Value } from 'google-protobuf/google/protobuf/struct_pb';
import * as fs from 'fs';
import * as redis from 'redis';

import { Field, StepInterface } from './base-step';

import { ICogServiceServer } from '../proto/cog_grpc_pb';
import { ManifestRequest, CogManifest, Step, RunStepRequest, RunStepResponse, FieldDefinition,
  StepDefinition } from '../proto/cog_pb';
import { ClientWrapper } from '../client/client-wrapper';

export class Cog implements ICogServiceServer {

  private steps: StepInterface[];
  private redisClient: any;

  constructor (private clientWrapperClass, private stepMap: Record<string, any> = {}, private redisUrl: string = undefined) {
    this.steps = [].concat(...Object.values(this.getSteps(`${__dirname}/../steps`, clientWrapperClass)));
<<<<<<< HEAD
<<<<<<< HEAD
    let url = this.redisUrl || "redis://:p54b68c8e0d07be9010838d91531d5d036265f0bd780c2b0d64e8fd420ed0f561@ec2-44-197-54-235.compute-1.amazonaws.com:11689";
=======
    const url = this.redisUrl || 'redis://:p54b68c8e0d07be9010838d91531d5d036265f0bd780c2b0d64e8fd420ed0f561@ec2-44-197-54-235.compute-1.amazonaws.com:11689';
>>>>>>> parent of 8a5066d (removed default redisUrl, as a default should be set earlier)
    this.redisClient = redis.createClient(url);
=======
    this.redisClient = redis.createClient(this.redisUrl);
>>>>>>> parent of c5d3035 (Revert to  "cleaned up for linter")
  }

  private getSteps(dir: string, clientWrapperClass) {
    const steps = fs.readdirSync(dir, { withFileTypes: true })
    .map((file: fs.Dirent) => {
      if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
        const step = require(`${dir}/${file.name}`).Step;
        const stepInstance: StepInterface = new step(clientWrapperClass);
        this.stepMap[stepInstance.getId()] = step;
        return stepInstance;
      } if (file.isDirectory()) {
        return this.getSteps(`${__dirname}/../steps/${file.name}`, clientWrapperClass);
      }
    });

    // Note: this filters out files that do not match the above (e.g. READMEs
    // or .js.map files in built folder, etc).
    return steps.filter(s => s !== undefined);
  }

  getManifest(
    call: grpc.ServerUnaryCall<ManifestRequest>,
    callback: grpc.sendUnaryData<CogManifest>,
  ) {
    const manifest: CogManifest = new CogManifest();
    const pkgJson: Record<string, any> = JSON.parse(
      fs.readFileSync('package.json').toString('utf8'),
    );
    const stepDefinitions: StepDefinition[] = this.steps.map((step: StepInterface) => {
      return step.getDefinition();
    });

    manifest.setName(pkgJson.cog.name);
    manifest.setLabel(pkgJson.cog.label);
    manifest.setVersion(pkgJson.version);
    if (pkgJson.cog.homepage) {
      manifest.setHomepage(pkgJson.cog.homepage);
    }
    if (pkgJson.cog.authHelpUrl) {
      manifest.setAuthHelpUrl(pkgJson.cog.authHelpUrl);
    }

    manifest.setStepDefinitionsList(stepDefinitions);

    ClientWrapper.expectedAuthFields.forEach((field: Field) => {
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
      const response: RunStepResponse = await this.dispatchStep(step, runStepRequest, call.metadata);
      call.write(response);

      processing = processing - 1;

      // If this was the last step to process and the client has ended the
      // stream, then end our stream as well.
      if (processing === 0 && clientEnded) {
        this.redisClient.quit();
        call.end();
      }
    });

    call.on('end', () => {
      clientEnded = true;

      // Only end the stream if we are done processing all steps.
      if (processing === 0) {
        this.redisClient.quit();
        call.end();
      }
    });
  }

  async runStep(
    call: grpc.ServerUnaryCall<RunStepRequest>,
    callback: grpc.sendUnaryData<RunStepResponse>,
  ) {
    const step: Step = call.request.getStep();
    const response: RunStepResponse = await this.dispatchStep(step, call.request, call.metadata);
    callback(null, response);
  }

  private async dispatchStep(
    step: Step,
    runStepRequest: RunStepRequest,
    metadata: grpc.Metadata,
    client = null,
  ): Promise<RunStepResponse> {
    // Get scoped IDs for building cache keys
    const idMap: {} = {
      requestId: runStepRequest.getRequestId(),
      scenarioId: runStepRequest.getScenarioId(),
      requestorId: runStepRequest.getRequestorId(),
    };
    // If a pre-auth'd client was provided, use it. Otherwise, create one.
    const wrapper = client || this.getClientWrapper(metadata, idMap);
    const stepId = step.getStepId();
    let response: RunStepResponse = new RunStepResponse();

    if (!this.stepMap.hasOwnProperty(stepId)) {
      response.setOutcome(RunStepResponse.Outcome.ERROR);
      response.setMessageFormat('Unknown step %s');
      response.addMessageArgs(Value.fromJavaScript(stepId));
      return response;
    }

    try {
      const stepExecutor: StepInterface = new this.stepMap[stepId](wrapper);
      response = await stepExecutor.executeStep(step);
    } catch (e) {
      response.setOutcome(RunStepResponse.Outcome.ERROR);
      response.setResponseData(Struct.fromJavaScript(e));
    }

    return response;
  }

  private getClientWrapper(auth: grpc.Metadata, idMap: {} = null) {
    const client = new ClientWrapper(auth);
    return new this.clientWrapperClass(client, this.redisClient, idMap);
  }
}
