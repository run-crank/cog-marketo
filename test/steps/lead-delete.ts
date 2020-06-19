import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/lead-delete';

chai.use(sinonChai);

describe('DeleteLeadStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByEmail = sinon.stub();
    clientWrapperStub.deleteLeadById = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('DeleteLeadStep');
    expect(stepDef.getName()).to.equal('Delete a Marketo Lead');
    expect(stepDef.getExpression()).to.equal('delete the (?<email>.+) marketo lead');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const expectedEmail: string = 'sampleEmail@email.com';
    protoStep.setData(Struct.fromJavaScript({
      email: expectedEmail,
    }));
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [
        {
          id: '12345',
        },
      ],
    }));
    clientWrapperStub.deleteLeadById.returns(Promise.resolve({
      success: true,
      result: [
        {
          status: 'deleted',
        },
      ],
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedEmail);
  });

  it('should respond with error if the marketo unable to delete lead', async () => {
    const expectedEmail: string = 'sampleEmail@email.com';
    const expectedResponse: string = 'Unable to delete lead %s: %s';
    protoStep.setData(Struct.fromJavaScript({
      email: expectedEmail,
    }));
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [
        {
          id: '12345',
        },
      ],
    }));
    clientWrapperStub.deleteLeadById.returns(Promise.resolve({
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
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedEmail);
  });

  it('should respond with error if the marketo could not find lead', async () => {
    const expectedEmail: string = 'sampleEmail@email.com';
    const expectedMessage: string = 'a lead with that email address does not exist';
    protoStep.setData(Struct.fromJavaScript({
      email: expectedEmail,
    }));
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: false,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedEmail);
    expect(response.getMessageArgsList()[1].getStringValue()).to.equal(expectedMessage);
  });

  it('should respond with error if the marketo throws an error', async () => {
    const expectedEmail: string = 'sampleEmail@email.com';
    const expectedMessage: string = 'a lead with that email address does not exist.';
    const expectedError: string = 'any error';
    protoStep.setData(Struct.fromJavaScript({
      email: expectedEmail,
    }));
    clientWrapperStub.findLeadByEmail.throws(expectedError);
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedEmail);
    expect(response.getMessageArgsList()[1].getStringValue()).to.equal(expectedError);
  });
});
