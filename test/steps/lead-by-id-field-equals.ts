import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/lead-by-id-field-equals';

chai.use(sinonChai);

describe('LeadByIdFieldEqualsStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByField = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('LeadByIdFieldEqualsStep');
    expect(stepDef.getName()).to.equal('Check a field on a Marketo lead by ID');
    expect(stepDef.getExpression()).to.equal('the (?<field>[a-zA-Z0-9_-]+) field on marketo lead with id (?<leadId>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // Email field
    expect(fields[0].key).to.equal('leadId');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);

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
    expect(fields[3].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[3].type).to.equal(FieldDefinition.Type.ANYSCALAR);

    // Partition ID field
    expect(fields[4].key).to.equal('partitionId');
    expect(fields[4].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[4].type).to.equal(FieldDefinition.Type.NUMERIC);
  });

  it('should call the client wrapper with the expected args', async () => {
    const expectedField: string = 'firstName';
    const expectedId: string = '1';
    const expectedPartitionId: number = 3;
    protoStep.setData(Struct.fromJavaScript({
      leadId: expectedId,
      field: expectedField,
      operator: 'be',
      expectation: expectedId,
      partitionId: expectedPartitionId,
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.findLeadByField).to.have.been.calledWith(
      'id',
      expectedId,
      sinon.match.any,
      expectedPartitionId,
    );
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    // Cause the client to throw an error, and execute the step.
    clientWrapperStub.findLeadByField.throws('any error');
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo client did not find a lead', async () => {
    // Have the client respond with no leads.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the lead found does not contain the given field', async () => {
    protoStep.setData(Struct.fromJavaScript({
      expectation: 'anything',
      leadId: 1,
      field: 'firstname',
    }));

    // Have the client respond with an object not containing the field above.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: '<-- Notice the case',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with a failure if the field on the lead does not match the expectation', async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'firstName',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: `Not ${expectedValue}`,
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with a pass if the field on the lead matches the expectation', async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'firstName',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: expectedValue,
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead matches the expectation with 'be' operator", async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'firstName',
      operator: 'be',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: expectedValue,
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead matches the expectation with 'contain' operator", async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'firstName',
      operator: 'contain',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'AtomaWithExtraLetters',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead satisfies the expectation with number value and 'be greater than' operator", async () => {
    const expectedValue: string = '5';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'someNumberField',
      operator: 'be greater than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someNumberField: '10',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead satisfies the expectation with date value and 'be greater than' operator", async () => {
    const expectedValue: string = '2000-01-01';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'someDateField',
      operator: 'be greater than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-02-01',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead matches the expectation with 'not be' operator", async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'firstName',
      operator: 'not be',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someOtherValue',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead matches the expectation with 'not contain' operator", async () => {
    const expectedValue: string = 'Atoma';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'firstName',
      operator: 'not contain',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'Atom',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead satisfies the expectation with number value and 'be less than' operator", async () => {
    const expectedValue: string = '10';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'someNumberField',
      operator: 'be less than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someNumberField: '5',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the field on the lead satisfies the expectation with date value and 'be less than' operator", async () => {
    const expectedValue: string = '2000-02-01';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'someDateField',
      operator: 'be less than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-01-01',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with an error if the field on the lead is not a date or number and 'be less than' operator", async () => {
    const expectedValue: string = 'notANumber';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'someDateField',
      operator: 'be less than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-01-01',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it("should respond with an error if the field on the lead is not a date or number and 'be greater than' operator", async () => {
    const expectedValue: string = 'notANumber';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'someDateField',
      operator: 'be greater than',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-01-01',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the operator is invalid', async () => {
    const expectedValue: string = '12345';
    protoStep.setData(Struct.fromJavaScript({
      expectation: expectedValue,
      leadId: 1,
      field: 'someDateField',
      operator: 'someOtherOperator',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'someName',
        someDateField: '2000-01-01',
      }],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error when expectedValue is not passed and operators are not either "be set" or "not be set"', async () => {
    protoStep.setData(Struct.fromJavaScript({
      leadId: 1,
      field: 'someDateField',
      operator: 'be',
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });
});
