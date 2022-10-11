import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../../src/proto/cog_pb';
import { Step } from '../../../src/steps/program-members/bulk-program-member-add-or-remove copy';

chai.use(sinonChai);

describe('BulkAddOrRemoveProgramMemberStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.bulkSetStatusToLeadFromProgram = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('BulkAddOrRemoveProgramMemberStep');
    expect(stepDef.getName()).to.equal('Bulk Add or Remove Marketo Program Members');
    expect(stepDef.getExpression()).to.equal('bulk add or remove marketo program members');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should call the client wrapper with the expected args', async () => {
    protoStep.setData(Struct.fromJavaScript({
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
          status: 'anyStatus',
        },
        2: {
          email: 'sampleEmail2@example.com',
          status: 'anyStatus',
        },
        3: {
          email: 'sampleEmail3@example.com',
          status: 'anyStatus',
        },
      },
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.bulkSetStatusToLeadFromProgram).to.have.been.calledWith(
      Object.values(protoStep.getData().toJavaScript().leads),
    );
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const expectedEmail: string = 'expected@example.com';
    const expectedReason: string = 'reason it failed';
    clientWrapperStub.bulkSetStatusToLeadFromProgram.returns(Promise.resolve([
      {
        success: true,
        result: [
          {
            status: 'created',
            id: 123321,
          },
          {
            status: 'updated',
            id: 123322,
          },
          {
            status: 'updated',
            id: 123323,
          },
        ],
      },
    ]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
          status: 'anyStatus',
        },
        2: {
          email: 'sampleEmail2@example.com',
          status: 'anyStatus',
        },
        3: {
          email: 'sampleEmail3@example.com',
          status: 'anyStatus',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if the partition does not exist', async () => {
    const expectedEmail: string = 'expected@example.com';
    const expectedReason: string = 'reason it failed';
    clientWrapperStub.bulkSetStatusToLeadFromProgram.returns(Promise.resolve([{ error: { partition: false } }]));
    protoStep.setData(Struct.fromJavaScript({
      partitionId: 23,
      programId: 'anyId',
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
          status: 'anyStatus',
        },
        2: {
          email: 'sampleEmail2@example.com',
          status: 'anyStatus',
        },
        3: {
          email: 'sampleEmail3@example.com',
          status: 'anyStatus',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with fail if marketo skips adding or removing of member with reason', async () => {
    const expectedReason: string = 'reason it failed';
    clientWrapperStub.bulkSetStatusToLeadFromProgram.returns(Promise.resolve([{
      success: true,
      result: [
        {
          status: 'skipped',
          reasons: [
            {
              message: expectedReason,
            },
          ],
        },
        {
          status: 'skipped',
          reasons: [
            {
              message: expectedReason,
            },
          ],
        },
        {
          status: 'created',
          id: 123323,
        },
      ],
    }]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
          status: 'anyStatus',
        },
        2: {
          email: 'sampleEmail2@example.com',
          status: 'anyStatus',
        },
        3: {
          email: 'sampleEmail3@example.com',
          status: 'anyStatus',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    expect(response.getMessageArgsList()[0].getNumberValue()).to.equal(2);
  });

  it('should respond with fail if marketo skips adding or removing of member', async () => {
    const expectedMessage: string  = 'Failed to create or update 1 leads';
    clientWrapperStub.bulkSetStatusToLeadFromProgram.returns(Promise.resolve([{
      success: true,
      result: [
        {
          status: 'created',
          id: 123321,
        },
        {
          status: 'skipped',
        },
        {
          status: 'updated',
          id: 123323,
        },
      ],
    }]));
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
          status: 'anyStatus',
        },
        2: {
          email: 'sampleEmail2@example.com',
          status: 'anyStatus',
        },
        3: {
          email: 'sampleEmail3@example.com',
          status: 'anyStatus',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    expect(response.getMessageArgsList()[0].getNumberValue()).to.equal(1);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    clientWrapperStub.bulkSetStatusToLeadFromProgram.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      programId: 'anyId',
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
          status: 'anyStatus',
        },
        2: {
          email: 'sampleEmail2@example.com',
          status: 'anyStatus',
        },
        3: {
          email: 'sampleEmail3@example.com',
          status: 'anyStatus',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
