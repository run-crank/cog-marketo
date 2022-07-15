import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/static-lists/static-list-member-count';

chai.use(sinonChai);

describe('StaticListMemberCountStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findStaticListsByName = sinon.stub();
    clientWrapperStub.findStaticListsMembershipByListId = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('StaticListMemberCountStep');
    expect(stepDef.getName()).to.equal('Check the number of a Marketo Static List Members');
    expect(stepDef.getExpression()).to.equal('the number of members from marketo static list (?<staticListName>.+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // Static List Name field
    expect(fields[0].key).to.equal('staticListName');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);

    // Operator field
    expect(fields[1].key).to.equal('operator');
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[1].type).to.equal(FieldDefinition.Type.STRING);

    // Expectation field
    expect(fields[2].key).to.equal('expectation');
    expect(fields[2].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[2].type).to.equal(FieldDefinition.Type.ANYSCALAR);
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    // Cause the client to throw an error, and execute the step.
    clientWrapperStub.findStaticListsByName.throws('any error');
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the marketo client did not find a static list', async () => {
    // Have the client respond with no leads.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with a pass if the count of member does not match the expectation', async () => {
    const expectedStaticListName: string = 'firstName';
    const expectedCount: number = 2;
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'be',
      expectation: expectedCount,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with a pass if the count of member matches the expectation', async () => {
    const expectedStaticListName: string = 'firstName';
    const expectedCount: number = 1;
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'be',
      expectation: expectedCount,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the count of member matches the expectation with 'be' operator", async () => {
    const expectedStaticListName: string = 'firstName';
    const expectedCount: number = 1;
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'be',
      expectation: expectedCount,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the count of member matches satisfies the expectation with number value and 'be greater than' operator", async () => {
    const expectedStaticListName: string = 'firstName';
    const expectedCount: number = 0;
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'be greater than',
      expectation: expectedCount,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the count of member matches the expectation with 'not be' operator", async () => {
    const expectedStaticListName: string = 'firstName';
    const expectedCount: number = 0;
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'not be',
      expectation: expectedCount,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with a pass if the count of member satisfies the expectation with number value and 'be less than' operator", async () => {
    const expectedStaticListName: string = 'firstName';
    const expectedCount: number = 2;
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'be less than',
      expectation: expectedCount,
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it("should respond with an error if the count of member is not a date or number and 'be less than' operator", async () => {
    const expectedStaticListName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'be less than',
      expectation: 'not a number',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it("should respond with an error if the count of member is not a date or number and 'be greater than' operator", async () => {
    const expectedStaticListName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'be greater than',
      expectation: 'not a number',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with an error if the operator is invalid', async () => {
    const expectedStaticListName: string = 'firstName';
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'not a valid operator',
      expectation: 'not a number',
    }));

    // Have the client respond with a valid, but mismatched lead.
    clientWrapperStub.findStaticListsByName.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        name: 'anyName',
      }],
    }));

    clientWrapperStub.findStaticListsMembershipByListId.returns(Promise.resolve({
      success: true,
      result: [{
        id: 'anyId',
        firstName: 'anyName',
      }],
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error when expectedValue is not passed and operators are not either "be set" or "not be set"', async () => {
    const expectedStaticListName: string = 'firstName';
    const expectedCount: number = 2;
    protoStep.setData(Struct.fromJavaScript({
      staticListName: expectedStaticListName,
      operator: 'be',
    }));

    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });
});
