import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/lead-field-equals';

chai.use(sinonChai);

describe('LeadFieldEqualsStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByEmail = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('LeadFieldEqualsStep');
    expect(stepDef.getName()).to.equal('Check a field on a Marketo Lead');
    expect(stepDef.getExpression()).to.equal('the (?<field>[a-zA-Z0-9_-]+) field on marketo lead (?<email>.+) should (?<operator>be less than|be greater than|be|contain|not be|not contain) (?<expectation>.+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // Email field
    expect(fields[0].key).to.equal('email');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[0].type).to.equal(FieldDefinition.Type.EMAIL);

    // Field Name field
    expect(fields[1].key).to.equal('field');
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[1].type).to.equal(FieldDefinition.Type.STRING);

    // Operator field
    expect(fields[2].key).to.equal('operator');
    expect(fields[2].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[2].type).to.equal(FieldDefinition.Type.STRING);

    // Expectation field
    expect(fields[3].key).to.equal('expectation');
    expect(fields[3].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[3].type).to.equal(FieldDefinition.Type.ANYSCALAR);
  });

  it('should call the client wrapper with the expected args', async () => {
    const expectedField: string = 'firstName';
    const expectedEmail: string = 'expected@example.com';
    protoStep.setData(Struct.fromJavaScript({
      email: expectedEmail,
      field: expectedField,
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.findLeadByEmail).to.have.been.calledWith(
      expectedEmail
    );
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    // Cause the client to throw an error, and execute the step.
    clientWrapperStub.findLeadByEmail.throws('any error');
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo client did not find a lead', async () => {
    // Have the client respond with no leads.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: []
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the lead found does not contain the given field', async () => {
    protoStep.setData(Struct.fromJavaScript({
      expectation: 'anything',
      email: 'anyone@example.com',
      field: 'firstname',
    }));

    // Have the client respond with an object not containing the field above.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: '<-- Notice the case',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with a failure if the field on the lead does not match the expectation', async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'firstName',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: `Not ${expectedValue}`
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with a pass if the field on the lead matches the expectation', async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'firstName',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: expectedValue
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead matches the expectation with 'be' operator", async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'firstName',
      operator: 'be'
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: expectedValue
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead matches the expectation with 'contain' operator", async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'firstName',
      operator: 'contain'
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'AtomaWithExtraLetters',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead satisfies the expectation with number value and 'be greater than' operator", async () => {
    const expectedValue: string = '5';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'someNumberField',
      operator: 'be greater than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someNumberField: '10',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead satisfies the expectation with date value and 'be greater than' operator", async () => {
    const expectedValue: string = '2000-01-01';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'someDateField',
      operator: 'be greater than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-02-01',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead matches the expectation with 'not be' operator", async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'firstName',
      operator: 'not be'
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someOtherValue'
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead matches the expectation with 'not contain' operator", async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'firstName',
      operator: 'not contain'
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'Atom',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead satisfies the expectation with number value and 'be less than' operator", async () => {
    const expectedValue: string = '10';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'someNumberField',
      operator: 'be less than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someNumberField: '5',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead satisfies the expectation with date value and 'be less than' operator", async () => {
    const expectedValue: string = '2000-02-01';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'someDateField',
      operator: 'be less than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-01-01',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with an error if the field on the lead is not a date or number and 'be less than' operator", async () => {
    const expectedValue: string = 'notANumber';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'someDateField',
      operator: 'be less than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-01-01',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it("should respond with an error if the field on the lead is not a date or number and 'be greater than' operator", async () => {
    const expectedValue: string = 'notANumber';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'someDateField',
      operator: 'be greater than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-01-01',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the operator is invalid', async () => {
    const expectedValue: string = '12345';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      email: 'anyone@example.com',
      field: 'someDateField',
      operator: 'someOtherOperator',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-01-01',
      }]
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
