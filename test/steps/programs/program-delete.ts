import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/programs/program-delete';

chai.use(sinonChai);

describe('DeleteProgramStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findProgramsByName = sinon.stub();
    clientWrapperStub.deleteProgramById = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('DeleteProgramStep');
    expect(stepDef.getName()).to.equal('Delete a Marketo Program');
    expect(stepDef.getExpression()).to.equal('delete the (?<name>.+) marketo program');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const expectedName: string = 'sampleName';
    protoStep.setData(Struct.fromJavaScript({
      name: expectedName,
    }));
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [
        {
          id: '12345',
        },
      ],
    }));
    clientWrapperStub.deleteProgramById.returns(Promise.resolve({
      success: true,
      result: [
        {
          id: '12345',
          status: '',
        },
      ],
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedName);
  });

  it('should respond with error if the marketo unable to delete program', async () => {
    const expectedName: string = 'sampleName';
    const expectedResponse: string = 'Unable to delete program %s: %s';
    protoStep.setData(Struct.fromJavaScript({
      name: expectedName,
    }));
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [
        {
          id: '12345',
        },
      ],
    }));
    clientWrapperStub.deleteProgramById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'failed',
        },
      ],
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    expect(response.getMessageFormat()).to.equal(expectedResponse);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedName);
  });

  it('should respond with error if the marketo could not find program', async () => {
    const expectedName: string = 'sampleName';
    const expectedMessage: string = 'a program with that name does not exist';
    protoStep.setData(Struct.fromJavaScript({
      name: expectedName,
    }));
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: false,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedName);
    expect(response.getMessageArgsList()[1].getStringValue()).to.equal(expectedMessage);
  });

  it('should respond with error if the marketo throws an error', async () => {
    const expectedName: string = 'sampleName';
    const expectedMessage: string = 'a program with that name address does not exist.';
    const expectedError: string = 'any error';
    protoStep.setData(Struct.fromJavaScript({
      name: expectedName,
    }));
    clientWrapperStub.findProgramsByName.throws(expectedError);
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedName);
    expect(response.getMessageArgsList()[1].getStringValue()).to.equal(expectedError);
  });
});
