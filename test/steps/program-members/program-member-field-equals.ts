import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/program-members/program-member-field-equals';

chai.use(sinonChai);

describe('ProgramMemberFieldEqualsStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByField = sinon.stub();
    clientWrapperStub.findProgramsByName = sinon.stub();
    clientWrapperStub.getProgramMembersFields = sinon.stub();
    clientWrapperStub.getProgramMembersByFilterValue = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);

    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [
        {id: 123123},
      ],
    }));

    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [
        {id: 123123, name: 'anyProgram'},
      ],
    }));

    clientWrapperStub.getProgramMembersFields.returns(Promise.resolve({
      success: true,
      result: [
        {name: 'anyFieldName', fields: [{name: 'anyField'}]},
      ],
    }));

    clientWrapperStub.getProgramMembersByFilterValue.returns(Promise.resolve({
      success: true,
      result: [
        {leadId: 123123, programId: 123123, anyField: 'anyValue'},
      ],
    }));
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('ProgramMemberFieldEqualsStep');
    expect(stepDef.getName()).to.equal('Check a field on a Marketo program member');
    expect(stepDef.getExpression()).to.equal('the (?<field>[a-zA-Z0-9_-]+) field on marketo member (?<email>.+) from program (?<programName>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // programName field
    expect(fields[0].key).to.equal('programName');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);

    // lead field
    expect(fields[1].key).to.equal('email');
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[1].type).to.equal(FieldDefinition.Type.STRING);

    // Field Name field
    expect(fields[2].key).to.equal('field');
    expect(fields[2].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[2].type).to.equal(FieldDefinition.Type.STRING);

    // Operator field
    expect(fields[3].key).to.equal('operator');
    expect(fields[3].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[3].type).to.equal(FieldDefinition.Type.STRING);

    // Expectation field
    expect(fields[4].key).to.equal('expectation');
    expect(fields[4].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[4].type).to.equal(FieldDefinition.Type.ANYSCALAR);

    // partitionId field
    expect(fields[5].key).to.equal('partitionId');
    expect(fields[5].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[5].type).to.equal(FieldDefinition.Type.NUMERIC);
  });

  it('should respond with pass', async () => {
    const expectedField: string = 'anyField';
    const expectedValue: string = 'anyValue';
    const programName: string = 'anyProgram';
    const email: string = 'anyEmail@test.com';
    protoStep.setData(Struct.fromJavaScript({
      programName: programName,
      email: email,
      field: expectedField,
      operator: 'be',
      expectation: expectedValue,
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    const expectedField: string = 'anyField';
    const expectedValue: string = 'anyValue';
    const programName: string = 'anyProgram';
    const email: string = 'anyEmail@test.com';
    protoStep.setData(Struct.fromJavaScript({
      programName: programName,
      email: email,
      field: expectedField,
      operator: 'be',
      expectation: expectedValue,
    }));

    // Cause the client to throw an error, and execute the step.
    clientWrapperStub.findLeadByField.throws('any error');
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo client did not find lead', async () => {
    const expectedField: string = 'anyField';
    const expectedValue: string = 'anyValue';
    const programName: string = 'anyProgram';
    const email: string = 'anyEmail@test.com';
    protoStep.setData(Struct.fromJavaScript({
      programName: programName,
      email: email,
      field: expectedField,
      operator: 'be',
      expectation: expectedValue,
    }));

    // Have the client respond with no programs.
    clientWrapperStub.findLeadByField.resolves({
      success: true,
      result: [],
    });

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo client did not find program', async () => {
    const expectedField: string = 'anyField';
    const expectedValue: string = 'anyValue';
    const programName: string = 'anyProgram';
    const email: string = 'anyEmail@test.com';
    protoStep.setData(Struct.fromJavaScript({
      programName: programName,
      email: email,
      field: expectedField,
      operator: 'be',
      expectation: expectedValue,
    }));

    // Have the client respond with no programs.
    clientWrapperStub.findProgramsByName.returns(Promise.resolve({
      success: true,
      result: [],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the program found does not contain the given field', async () => {
    const expectedField: string = 'anyField';
    const expectedValue: string = 'anyValue';
    const programName: string = 'anyProgram';
    const email: string = 'anyEmail@test.com';
    protoStep.setData(Struct.fromJavaScript({
      programName: programName,
      email: email,
      field: expectedField,
      operator: 'be',
      expectation: expectedValue,
    }));

    // Have the client respond with an object not containing the field above.
    clientWrapperStub.getProgramMembersByFilterValue.returns(Promise.resolve({
      success: true,
      result: [
        {leadId: 123123, programId: 123123, anyOtherField: 'anyOtherValue'},
      ],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with an unknown util error', async () => {
    const expectedField: string = 'anyField';
    const expectedValue: string = 'anyValue';
    const programName: string = 'anyProgram';
    const email: string = 'anyEmail@test.com';
    protoStep.setData(Struct.fromJavaScript({
      programName: programName,
      email: email,
      field: expectedField,
      operator: 'unknown operator',
      expectation: expectedValue,
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getMessageFormat()).to.equal('%s Please provide one of: %s');
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an invalid operand error', async () => {
    const expectedField: string = 'anyField';
    const programName: string = 'anyProgram';
    const email: string = 'anyEmail@test.com';
    protoStep.setData(Struct.fromJavaScript({
      programName: programName,
      email: email,
      field: expectedField,
      operator: 'be greater than',
      expectation: 'not a number',
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if expection was not provided when required', async () => {
    const expectedField: string = 'anyField';
    const programName: string = 'anyProgram';
    const email: string = 'anyEmail@test.com';
    protoStep.setData(Struct.fromJavaScript({
      programName: programName,
      email: email,
      field: expectedField,
      operator: 'be',
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });
});
