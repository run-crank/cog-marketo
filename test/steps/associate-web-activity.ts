import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/associate-web-activity';

chai.use(sinonChai);

describe('AssociateWebActivityStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByEmail = sinon.stub();
    clientWrapperStub.associateLeadById = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('AssociateWebActivityStep');
    expect(stepDef.getName()).to.equal('Associate Web Activity');
    expect(stepDef.getExpression()).to.equal('associate web activity with munchkin cookie (?<munchkinCookie>.+) to marketo lead (?<email>.+\@.+\..+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const expectedEmail: string = 'sampleEmail@email.com';
    const expectedCookie: string = 'id:123-ABC-789&token:_mch-stackmoxie.com-1234567891011-12345';
    protoStep.setData(Struct.fromJavaScript({
      munchkinCookie: expectedCookie,
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
    clientWrapperStub.associateLeadById.returns(Promise.resolve({
      success: true,
      requestId: '99999',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedCookie);
    expect(response.getMessageArgsList()[1].getStringValue()).to.equal(expectedEmail);
  });

  it('should respond with error if Marketo is unable to associate the cookie with the lead', async () => {
    const expectedEmail: string = 'sampleEmail@email.com';
    const expectedCookie: string = 'id:123-ABC-789&token:_mch-stackmoxie.com-1234567891011-12345';
    const expectedResponse: string = 'Unable to assocated munchkin cookie %s with Marketo lead %s';
    protoStep.setData(Struct.fromJavaScript({
      munchkinCookie: expectedCookie,
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
    clientWrapperStub.associateLeadById.returns(Promise.resolve({
      success: false,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    expect(response.getMessageFormat()).to.equal(expectedResponse);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedCookie);
    expect(response.getMessageArgsList()[1].getStringValue()).to.equal(expectedEmail);
  });

  it('should respond with error if Marketo could not find lead', async () => {
    const expectedEmail: string = 'sampleEmail@email.com';
    const expectedCookie: string = 'id:123-ABC-789&token:_mch-stackmoxie.com-1234567891011-12345';
    const expectedMessage: string = "Couldn't find a lead associated with %s%s";
    protoStep.setData(Struct.fromJavaScript({
      munchkinCookie: expectedCookie,
      email: expectedEmail,
    }));
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: false,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    expect(response.getMessageFormat()).to.equal(expectedMessage);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedEmail);
  });

  it('should respond with error if the marketo throws an error', async () => {
    const expectedEmail: string = 'sampleEmail@email.com';
    const expectedCookie: string = 'id:123-ABC-789&token:_mch-stackmoxie.com-1234567891011-12345';
    const expectedMessage: string = 'There was an error associating the munchkin cookie with the Marketo lead: %s';
    const expectedError: string = 'any error';
    protoStep.setData(Struct.fromJavaScript({
      munchkinCookie: expectedCookie,
      email: expectedEmail,
    }));
    clientWrapperStub.findLeadByEmail.throws(expectedError);
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    expect(response.getMessageFormat()).to.equal(expectedMessage);
    expect(response.getMessageArgsList()[0].getStringValue()).to.equal(expectedError);
  });
});
