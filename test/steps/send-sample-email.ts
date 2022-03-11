import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse, FieldDefinition } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/send-sample-email';

chai.use(sinonChai);

describe('SendSampleEmailStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.getEmails = sinon.stub();
    clientWrapperStub.sendSampleEmail = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('SendSampleEmailStep');
    expect(stepDef.getName()).to.equal('Send Sample Email');
    expect(stepDef.getExpression()).to.equal('send a sample email to (?<emailAddress>.+\@.+\..+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // Workspace field
    expect(fields[0].key).to.equal('workspace');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);

    // Program field
    expect(fields[1].key).to.equal('program');
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[1].type).to.equal(FieldDefinition.Type.STRING);

    // Email Asset field
    expect(fields[2].key).to.equal('emailAsset');
    expect(fields[2].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[2].type).to.equal(FieldDefinition.Type.ANYSCALAR);

    // Email Address field
    expect(fields[3].key).to.equal('emailAddress');
    expect(fields[3].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[3].type).to.equal(FieldDefinition.Type.EMAIL);
  });

  it('should respond with success if the marketo executes succesfully with numeric emailAsset', async () => {
    const expectedResponseMessage: string = 'Successfully sent Marketo email with id %d to %s';
    clientWrapperStub.getEmails.returns(Promise.resolve([
      {
        name: 'someEmail',
        id: '11111',
        folder: {
          id: '2222',
          folderName: 'someProgram',
        },
        workspace: 'Default',
      },
    ]));
    clientWrapperStub.sendSampleEmail.returns(Promise.resolve({
      success: true,
      result: [
        {
          sent: 'someEmail',
          email: 'someEmail',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      workspace: 'Default',
      program: 'someProgram',
      emailAsset: 11111,
      emailAddress: 'someEmailAddress',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with error if the marketo does not execute succesfully with numeric emailAsset', async () => {
    const expectedResponseMessage: string = 'There was an error sending the Marketo email with id %d';
    clientWrapperStub.getEmails.returns(Promise.resolve([
      {
        name: 'someEmail',
        id: '11111',
        folder: {
          id: '2222',
          folderName: 'someProgram',
        },
        workspace: 'Default',
      },
    ]));
    clientWrapperStub.sendSampleEmail.returns(Promise.resolve({
      success: false,
      result: [],
    }));
    protoStep.setData(Struct.fromJavaScript({
      workspace: 'Default',
      program: 'someProgram',
      emailAsset: 11111,
      emailAddress: 'someEmailAddress',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with success if the marketo executes succesfully with non numeric emailAsset', async () => {
    const expectedResponseMessage: string = 'Successfully sent Marketo email with id %d to %s';
    clientWrapperStub.getEmails.returns(Promise.resolve([
      {
        name: 'someEmail',
        id: '11111',
        folder: {
          id: '2222',
          folderName: 'someProgram',
        },
        workspace: 'Default',
      },
      {
        name: 'someOtherEmail',
        id: '11112',
        folder: {
          id: '2223',
          folderName: 'someOtherProgram',
        },
        workspace: 'Default',
      },
    ]));
    clientWrapperStub.sendSampleEmail.returns(Promise.resolve({
      success: true,
      result: [
        {
          sent: 'someEmail',
          email: 'someEmail',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      workspace: 'Default',
      program: 'someProgram',
      emailAsset: 'someEmail',
      emailAddress: 'someEmailAddress',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with error if there is more than one matching emails in Marketo', async () => {
    const expectedResponseMessage: string = 'Multiple Marketo emails match your criteria: found %d matching emails';
    clientWrapperStub.getEmails.returns(Promise.resolve([
      {
        name: 'someEmail',
        id: '11111',
        folder: {
          id: '2222',
          folderName: 'someProgram',
        },
        workspace: 'Default',
      },
      {
        name: 'someEmail',
        id: '11112',
        folder: {
          id: '2222',
          folderName: 'someProgram',
        },
        workspace: 'Default',
      },
    ]));
    clientWrapperStub.sendSampleEmail.returns(Promise.resolve({
      success: true,
      result: [
        {
          sent: 'someEmail',
          email: 'someEmail',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      workspace: 'Default',
      program: 'someProgram',
      emailAsset: 'someEmail',
      emailAddress: 'someEmailAddress',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if there are zero matching emails in Marketo', async () => {
    const expectedResponseMessage: string = 'No Marketo emails match your criteria: found %d matching emails';
    clientWrapperStub.getEmails.returns(Promise.resolve([
      {
        name: 'someEmail',
        id: '11111',
        folder: {
          id: '2222',
          folderName: 'someProgram',
        },
        workspace: 'Default',
      },
      {
        name: 'someOtherEmail',
        id: '11112',
        folder: {
          id: '2223',
          folderName: 'someOtherProgram',
        },
        workspace: 'Default',
      },
    ]));
    clientWrapperStub.sendSampleEmail.returns(Promise.resolve({
      success: true,
      result: [
        {
          sent: 'someEmail',
          email: 'someEmail',
        },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      workspace: 'Default',
      program: 'someProgram',
      emailAsset: 'emailThatDoesntExist',
      emailAddress: 'someEmailAddress',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if the marketo request throws an error', async () => {
    const expectedResponseMessage: string = 'There was an error sending the Marketo email: %s';
    clientWrapperStub.getEmails.throws('any error');
    clientWrapperStub.sendSampleEmail.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      workspace: 'Default',
      program: 'someProgram',
      emailAsset: 'emailThatDoesntExist',
      emailAddress: 'someEmailAddress',
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getMessageFormat()).to.equal(expectedResponseMessage);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });
});
