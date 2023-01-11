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
  
  describe('Single Lead Check', () => {

    beforeEach(() => {
      protoStep = new ProtoStep();
      clientWrapperStub = sinon.stub();
      clientWrapperStub.findLeadByField = sinon.stub();
      stepUnderTest = new Step(clientWrapperStub);
    });

    it('should return expected step metadata', () => {
      const stepDef: StepDefinition = stepUnderTest.getDefinition();
      expect(stepDef.getStepId()).to.equal('LeadFieldEqualsStep');
      expect(stepDef.getName()).to.equal('Check a field on a Marketo lead');
      expect(stepDef.getExpression()).to.equal('the (?<field>[a-zA-Z0-9_-]+) field on marketo lead (?<email>.+@.+..+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?');
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
      const expectedEmail: string = 'expected@example.com';
      const expectedPartitionId: number = 3;
      protoStep.setData(Struct.fromJavaScript({
        email: expectedEmail,
        field: expectedField,
        operator: 'be',
        expectation: expectedEmail,
        partitionId: expectedPartitionId,
      }));

      await stepUnderTest.executeStep(protoStep);
      expect(clientWrapperStub.findLeadByField).to.have.been.calledWith(
        'email',
        expectedEmail,
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
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
        email: 'anyone@example.com',
        field: 'someDateField',
        operator: 'be',
      }));

      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
  });
  
  describe('Bulk Lead Check', () => {
    beforeEach(() => {
      protoStep = new ProtoStep();
      clientWrapperStub = sinon.stub();
      clientWrapperStub.bulkFindLeadsByEmail = sinon.stub();
      stepUnderTest = new Step(clientWrapperStub);
    });
  
    it('should respond with an error if the marketo client throws an error', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        expectation: 'anything',
        field: 'firstname',
      }));
      // Cause the client to throw an error, and execute the step.
      clientWrapperStub.bulkFindLeadsByEmail.throws('any error');
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
  
    it('should respond with an error if the marketo client did not find a lead', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        expectation: 'anything',
        field: 'firstname',
      }));
  
      // Have the client respond with no leads.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve({
        success: true,
        result: [],
      }));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
  
    it('should respond with an error if the lead found does not contain the given field', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        expectation: 'anything',
        field: 'firstname',
      }));
  
      // Have the client respond with an object not containing the field above.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: '<-- Notice the case',
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: '<-- Notice the case',
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: '<-- Notice the case',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    });
    
    it('should respond with a failure if the number of leads does not match the number of expectations', async () => {
      const expectedValue: string = 'Atoma';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        multiple_expectation: ['expectation1', 'expectation2', 'expectation3'],
        field: 'firstName',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'not expected value',
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: 'not expected value',
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: 'not expected value',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      expect(response.toObject().messageFormat).to.contain('Number of leads provided did not match number of expected values provided');
    });
  
    it('should respond with a failure if the field on the lead does not match the expectation', async () => {
      const expectedValue: string = 'Atoma';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        field: 'firstName',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'not expected value',
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: 'not expected value',
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: 'not expected value',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      expect(response.toObject().messageFormat).to.contain('Found %d of %d leads where the %s field was found to %s %s');
    });
  
    it('should respond with a pass if the field on the lead matches the expectation', async () => {
      protoStep.setData(Struct.fromJavaScript({
        expectation: 'Atoma',
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'firstName',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Atoma',
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: 'Atoma',
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: 'Atoma',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
    
    it('should respond with a pass if the fields on all leads match dynamic expectations', async () => {
      protoStep.setData(Struct.fromJavaScript({
        expectation: 'Atoma',
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        multiple_expectation: ['expectation1', 'expectation2', 'expectation3'],
        field: 'firstName',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'expectation1',
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: 'expectation2',
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: 'expectation3',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with a pass if the field on the lead matches the expectation with 'be' operator", async () => {
      const expectedValue: string = 'Atoma';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'firstName',
        operator: 'be',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: expectedValue,
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: expectedValue,
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: expectedValue,
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with a pass if the field on the lead matches the expectation with 'contain' operator", async () => {
      const expectedValue: string = 'Atoma';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'firstName',
        operator: 'contain',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Atomawithextraletters',
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: 'Atomawithextraletters',
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: 'Atomawithextraletters',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with a pass if the field on the lead satisfies the expectation with number value and 'be greater than' operator", async () => {
      const expectedValue: string = '5';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'someNumberField',
        operator: 'be greater than',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          someNumberField: 10,
          id: 1,
          email: 'expected1@example.com',
        }, {
          someNumberField: 10,
          id: 2,
          email: 'expected2@example.com',
        }, {
          someNumberField: 10,
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with a pass if the field on the lead satisfies the expectation with date value and 'be greater than' operator", async () => {
      const expectedValue: string = '2000-01-01';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'someDateField',
        operator: 'be greater than',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          someDateField: '2000-02-02',
          id: 1,
          email: 'expected1@example.com',
        }, {
          someDateField: '2000-02-02',
          id: 2,
          email: 'expected2@example.com',
        }, {
          someDateField: '2000-02-02',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with a pass if the field on the lead matches the expectation with 'not be' operator", async () => {
      const expectedValue: string = 'Atoma';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'firstName',
        operator: 'not be',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Someothername',
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: 'Someothername',
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: 'Someothername',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with a pass if the field on the lead matches the expectation with 'not contain' operator", async () => {
      const expectedValue: string = 'Atoma';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'firstName',
        operator: 'not contain',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Atom',
          id: 1,
          email: 'expected1@example.com',
        }, {
          firstName: 'Atom',
          id: 2,
          email: 'expected2@example.com',
        }, {
          firstName: 'Atom',
          id: 3,
          email: 'expected3@example.com',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with a pass if the field on the lead satisfies the expectation with number value and 'be less than' operator", async () => {
      const expectedValue: string = '10';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'someNumberField',
        operator: 'be less than',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Atom',
          id: 1,
          email: 'expected1@example.com',
          someNumberField: 5,
        }, {
          firstName: 'Atom',
          id: 2,
          email: 'expected2@example.com',
          someNumberField: 5,
        }, {
          firstName: 'Atom',
          id: 3,
          email: 'expected3@example.com',
          someNumberField: 5,
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with a pass if the field on the lead satisfies the expectation with date value and 'be less than' operator", async () => {
      const expectedValue: string = '2000-02-01';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'someDateField',
        operator: 'be less than',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Atom',
          id: 1,
          email: 'expected1@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 2,
          email: 'expected2@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 3,
          email: 'expected3@example.com',
          someDateField: '2000-01-01',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Successfully checked %d leads');
    });
  
    it("should respond with an error if the field on the lead is not a date or number and 'be less than' operator", async () => {
      const expectedValue: string = 'notANumber';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'someDateField',
        operator: 'be less than',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Atom',
          id: 1,
          email: 'expected1@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 2,
          email: 'expected2@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 3,
          email: 'expected3@example.com',
          someDateField: '2000-01-01',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
  
    it("should respond with an error if the field on the lead is not a date or number and 'be greater than' operator", async () => {
      const expectedValue: string = 'notANumber';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'someDateField',
        operator: 'be greater than',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Atom',
          id: 1,
          email: 'expected1@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 2,
          email: 'expected2@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 3,
          email: 'expected3@example.com',
          someDateField: '2000-01-01',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
  
    it('should respond with an error if the operator is invalid', async () => {
      const expectedValue: string = '12345';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'someDateField',
        operator: 'someOtherOperator',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: true,
        result: [{
          firstName: 'Atom',
          id: 1,
          email: 'expected1@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 2,
          email: 'expected2@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 3,
          email: 'expected3@example.com',
          someDateField: '2000-01-01',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
  
    it('should respond with error when expectedValue is not passed and operators are not either "be set" or "not be set"', async () => {
      protoStep.setData(Struct.fromJavaScript({
        leads: {
          1: { email: 'expected1@example.com' },
          2: { email: 'expected2@example.com' },
          3: { email: 'expected3@example.com' },
        },
        field: 'someDateField',
        operator: 'be',
      }));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
  
    it('should respond with an error marketo returns a failure', async () => {
      const expectedValue: string = '12345';
      protoStep.setData(Struct.fromJavaScript({
        expectation: expectedValue,
        email: 'dummyEmail',
        multiple_email: ['expected1@example.com', 'expected2@example.com', 'expected3@example.com'],
        field: 'someDateField',
        operator: 'someOtherOperator',
      }));
  
      // Have the client respond with a valid, but mismatched lead.
      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: false,
        result: [{
          firstName: 'Atom',
          id: 1,
          email: 'expected1@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 2,
          email: 'expected2@example.com',
          someDateField: '2000-01-01',
        }, {
          firstName: 'Atom',
          id: 3,
          email: 'expected3@example.com',
          someDateField: '2000-01-01',
        }],
      }]));
  
      const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    });
    
    
  });
});
