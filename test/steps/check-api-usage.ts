import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/check-api-usage';

chai.use(sinonChai);

describe('CheckApiUsageStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.getDailyApiUsage = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CheckApiUsageStep');
    expect(stepDef.getName()).to.equal('Check daily Marketo API usage');
    expect(stepDef.getExpression()).to.equal('there should be less than 90% usage of your daily API limit');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should respond with success if the api calls are less than 90% of the daily limit', async () => {
    const expectedLimit: number = 10000;
    protoStep.setData(Struct.fromJavaScript({
      requestLimit: expectedLimit,
    }));
    clientWrapperStub.getDailyApiUsage.returns(Promise.resolve({
      success: true,
      result: [
        {            
          total: 8999,
        },
      ],
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with a failure if the api calls are more than 90% of the daily limit', async () => {
    const expectedLimit: number = 50000;
    protoStep.setData(Struct.fromJavaScript({
      requestLimit: expectedLimit,
    }));
    clientWrapperStub.getDailyApiUsage.returns(Promise.resolve({
      success: true,
      result: [
        {            
          total: 49000,
        },
      ],
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with an error if no usage is found', async () => {
    const expectedLimit: number = 50000;
    protoStep.setData(Struct.fromJavaScript({
      requestLimit: expectedLimit,
    }));
    clientWrapperStub.getDailyApiUsage.returns(Promise.resolve({
      success: true,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    // Cause the client to throw an error, and execute the step.
    clientWrapperStub.getDailyApiUsage.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      requestLimit: 50000,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });
});
