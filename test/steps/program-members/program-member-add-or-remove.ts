import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/program-members/program-member-add-or-remove';

chai.use(sinonChai);

describe('AddOrRemoveProgramMemberStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.bulkSetStatusToLeadsFromProgram = sinon.stub();
    clientWrapperStub.bulkRemoveLeadsFromProgram = sinon.stub();
    clientWrapperStub.bulkFindLeadsByEmail = sinon.stub();
    clientWrapperStub.bulkFindLeadsById = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('AddOrRemoveProgramMemberStep');
    expect(stepDef.getName()).to.equal('Add or Remove Marketo Program Members');
    expect(stepDef.getExpression()).to.equal('add or remove marketo program members');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });
    expect(fields[0].key).to.equal('partitionId');
    expect(fields[0].type).to.equal(FieldDefinition.Type.NUMERIC);
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[1].key).to.equal('programId');
    expect(fields[1].type).to.equal(FieldDefinition.Type.STRING);
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[2].key).to.equal('memberStatus');
    expect(fields[2].type).to.equal(FieldDefinition.Type.STRING);
    expect(fields[2].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[3].key).to.equal('email');
    expect(fields[3].type).to.equal(FieldDefinition.Type.STRING);
    expect(fields[3].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
  });

  it('should call the client wrapper with the expected args', async () => {
    const expectedEmails: string[] = [
      'sampleEmail1@example.com',
      'sampleEmail2@example.com',
      'sampleEmail3@example.com',
    ];
    
    clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
          {
            email: 'sampleEmail2@example.com',
            leadId: 123322,
          },
          {
            email: 'sampleEmail3@example.com',
            leadId: 123323,
          },
        ],
      },
    ]));
    
    protoStep.setData(Struct.fromJavaScript({
      multiple_email: expectedEmails
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.bulkSetStatusToLeadsFromProgram).to.have.been.calledWith(expectedEmails);
  });

  it('should respond with success if the marketo executes succesfully with multiple emails', async () => {
    clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
          {
            email: 'sampleEmail2@example.com',
            leadId: 123322,
          },
          {
            email: 'sampleEmail3@example.com',
            leadId: 123323,
          },
        ],
      },
    ]));
    
    clientWrapperStub.bulkSetStatusToLeadsFromProgram.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            status: 'created',
            leadId: 123321,
          },
          {
            status: 'updated',
            leadId: 123322,
          },
          {
            status: 'updated',
            leadId: 123323,
          },
        ],
      },
    ]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      multiple_email: [
        'sampleEmail1@example.com',
        'sampleEmail2@example.com',
        'sampleEmail3@example.com',
      ],
    }));
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });
  
  it('should respond with success if the marketo executes succesfully with multiple ids', async () => {
    clientWrapperStub.bulkFindLeadsById.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
          {
            email: 'sampleEmail2@example.com',
            leadId: 123322,
          },
          {
            email: 'sampleEmail3@example.com',
            leadId: 123323,
          },
        ],
      },
    ]));
    
    clientWrapperStub.bulkSetStatusToLeadsFromProgram.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            status: 'created',
            leadId: 123321,
          },
          {
            status: 'updated',
            leadId: 123322,
          },
          {
            status: 'updated',
            leadId: 123323,
          },
        ],
      },
    ]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      multiple_email: [
        123321,
        123322,
        123323,
      ],
    }));
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });
  
  it('should respond with success if the marketo executes succesfully with single email', async () => {
    clientWrapperStub.findLeadByEmail = sinon.stub();
    clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
        ],
      }));
    
    clientWrapperStub.bulkSetStatusToLeadsFromProgram.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            status: 'created',
            leadId: 123321,
          },
        ],
      },
    ]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      email: 'sampleEmail1@example.com',
    }));
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });
  
  it('should respond with success if the marketo executes succesfully with a single id', async () => {
    clientWrapperStub.findLeadByField = sinon.stub();
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
        ],
      }));
    
    clientWrapperStub.bulkSetStatusToLeadsFromProgram.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            status: 'created',
            leadId: 123321,
          },
        ],
      },
    ]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      email: '123321',
    }));
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if the partition does not exist', async () => {
    clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
          {
            email: 'sampleEmail2@example.com',
            leadId: 123322,
          },
          {
            email: 'sampleEmail3@example.com',
            leadId: 123323,
          },
        ],
      },
    ]));
    clientWrapperStub.bulkSetStatusToLeadsFromProgram.returns(Promise.resolve([{ error: { partition: false } }]));
    protoStep.setData(Struct.fromJavaScript({
      partitionId: 23,
      programId: 'anyId',
      multiple_email: [
        'sampleEmail1@example.com',
        'sampleEmail2@example.com',
        'sampleEmail3@example.com',
      ],
    }));
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });
  
  it('should respond with error if not all leads are found', async () => {
    clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
          {
            email: 'sampleEmail2@example.com',
            leadId: 123322,
          },
        ],
      },
    ]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      multiple_email: [
        'sampleEmail1@example.com',
        'sampleEmail2@example.com',
        'sampleEmail3@example.com',
      ],
    }));
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with fail if marketo skips adding or removing of member', async () => {
    clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
          {
            email: 'sampleEmail2@example.com',
            leadId: 123322,
          },
          {
            email: 'sampleEmail3@example.com',
            leadId: 123323,
          },
        ],
      },
    ]));
    
    clientWrapperStub.bulkSetStatusToLeadsFromProgram.returns(Promise.resolve([{
      success: true,
      result: [
        {
          status: 'created',
          leadId: 123321,
        },
        {
          status: 'skipped',
        },
        {
          status: 'updated',
          leadId: 123323,
        },
      ],
    }]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      multiple_email: [
        'sampleEmail1@example.com',
        'sampleEmail2@example.com',
        'sampleEmail3@example.com',
      ],
    }));
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            email: 'sampleEmail1@example.com',
            leadId: 123321,
          },
          {
            email: 'sampleEmail2@example.com',
            leadId: 123322,
          },
          {
            email: 'sampleEmail3@example.com',
            leadId: 123323,
          },
        ],
      },
    ]));
    
    clientWrapperStub.bulkSetStatusToLeadsFromProgram.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      multiple_email: [
        'sampleEmail1@example.com',
        'sampleEmail2@example.com',
        'sampleEmail3@example.com',
      ],
    }));
    const response: RunStepResponse = (await stepUnderTest.executeStep(protoStep)) as RunStepResponse;
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
