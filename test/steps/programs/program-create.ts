import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/programs/program-create';

chai.use(sinonChai);

describe('CreateProgramStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.createProgram = sinon.stub();
    clientWrapperStub.getFoldersById = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CreateProgramStep');
    expect(stepDef.getName()).to.equal('Create a Marketo Program');
    expect(stepDef.getExpression()).to.equal('create a marketo program');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should call the client wrapper with the expected args', async () => {
    protoStep.setData(Struct.fromJavaScript({
      name: 'sampleName',
      folder: 'sampleFolder',
      type: 'sampleType',
      channel: 'sampleChannel',
      description: 'sampleDesc',
    }));

    clientWrapperStub.getFoldersById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.createProgram).to.have.been.calledWith(`name=${protoStep.getData().toJavaScript().name}&folder=${JSON.stringify({
      id: 123321,
      type: "Folder"
    })}&description=${protoStep.getData().toJavaScript().description}&type=${protoStep.getData().toJavaScript().type}&channel=${protoStep.getData().toJavaScript().channel}`);
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const expectedName: string = 'expectedName';
    const expectedReason: string = 'reason it failed';

    clientWrapperStub.getFoldersById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));

    clientWrapperStub.createProgram.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: 'sampleName',
      folder: 'sampleFolder',
      type: 'sampleType',
      channel: 'sampleChannel',
      description: 'sampleDesc',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if the marketo skips creation of program with reason', async () => {
    const expectedReason: string = 'reason it failed';

    clientWrapperStub.getFoldersById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));

    clientWrapperStub.createProgram.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'skipped',
          reasons: [
            {
              message: expectedReason,
            },
          ],
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: 'sampleName',
      folder: 'sampleFolder',
      type: 'sampleType',
      channel: 'sampleChannel',
      description: 'sampleDesc',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedReason);
  });

  it('should respond with fail if the marketo skips creation of program', async () => {
    const expectedMessage: string  = 'status was skipped';

    clientWrapperStub.getFoldersById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));

    clientWrapperStub.createProgram.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'skipped',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      name: 'sampleName',
      folder: 'sampleFolder',
      type: 'sampleType',
      channel: 'sampleChannel',
      description: 'sampleDesc',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedMessage);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    clientWrapperStub.getFoldersById.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      name: 'sampleName',
      folder: 'sampleFolder',
      type: 'sampleType',
      channel: 'sampleChannel',
      description: 'sampleDesc',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
