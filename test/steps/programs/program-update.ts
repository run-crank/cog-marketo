import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/programs/program-update';

chai.use(sinonChai);

describe('UpdateProgramStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findProgramsById = sinon.stub();
    clientWrapperStub.updateProgram = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('UpdateProgramStep');
    expect(stepDef.getName()).to.equal('Update a Marketo Program');
    expect(stepDef.getExpression()).to.equal('update a marketo program');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should call the client wrapper with the expected args', async () => {
    protoStep.setData(Struct.fromJavaScript({
      id: '123',
      name: 'sampleName',
      description: 'sampleDesc',
    }));

    clientWrapperStub.findProgramsById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.findProgramsById).to.have.been.calledWith(
      protoStep.getData().toJavaScript().id,
    );
    expect(clientWrapperStub.updateProgram).to.have.been.calledWith(
      123321,
      `name=${protoStep.getData().toJavaScript().name}&description=${protoStep.getData().toJavaScript().description}`
    );
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const expectedName: string = 'expected@example.com';
    const expectedReason: string = 'reason it failed';

    clientWrapperStub.findProgramsById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));

    clientWrapperStub.updateProgram.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      id: '123',
      name: 'sampleName',
      description: 'sampleDesc',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if the marketo skips creation of program', async () => {
    const expectedMessage: string  = 'status was skipped';
    
    clientWrapperStub.findProgramsById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));

    clientWrapperStub.updateProgram.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'skipped',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      id: '123',
      name: 'sampleName',
      description: 'sampleDesc',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedMessage);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    clientWrapperStub.findProgramsById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'success',
          id: 123321,
        },
      ],
    }));

    clientWrapperStub.updateProgram.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      id: '123',
      name: 'sampleName',
      description: 'sampleDesc',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
