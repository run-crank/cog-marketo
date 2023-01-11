import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/bulk-lead-create-or-update';

chai.use(sinonChai);

describe('BulkCreateOrUpdateLeadByFieldStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.bulkCreateOrUpdateLead = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('BulkCreateOrUpdateLeadByFieldStep');
    expect(stepDef.getName()).to.equal('Bulk create or update Marketo leads');
    expect(stepDef.getExpression()).to.equal('bulk create or update marketo leads');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should call the client wrapper with the expected args', async () => {
    protoStep.setData(Struct.fromJavaScript({
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
        },
        2: {
          email: 'sampleEmail2@example.com',
        },
        3: {
          email: 'sampleEmail3@example.com',
        },
      },
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.bulkCreateOrUpdateLead).to.have.been.calledWith(
      Object.values(protoStep.getData().toJavaScript().leads),
    );
  });

  it('should respond with success if the marketo executes succesfully', async () => {
    const expectedEmail: string = 'expected@example.com';
    const expectedReason: string = 'reason it failed';
    clientWrapperStub.bulkCreateOrUpdateLead.returns(Promise.resolve([
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
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
        },
        2: {
          email: 'sampleEmail2@example.com',
        },
        3: {
          email: 'sampleEmail3@example.com',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with fail if the partition does not exist', async () => {
    const expectedEmail: string = 'expected@example.com';
    const expectedReason: string = 'reason it failed';
    clientWrapperStub.bulkCreateOrUpdateLead.returns(Promise.resolve([{ error: { partition: false } }]));
    protoStep.setData(Struct.fromJavaScript({
      partitionId: 23,
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
        },
        2: {
          email: 'sampleEmail2@example.com',
        },
        3: {
          email: 'sampleEmail3@example.com',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should respond with fail if marketo skips creation of lead with reason', async () => {
    const expectedReason: string = 'reason it failed';
    clientWrapperStub.bulkCreateOrUpdateLead.returns(Promise.resolve([{
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
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
        },
        2: {
          email: 'sampleEmail2@example.com',
        },
        3: {
          email: 'sampleEmail3@example.com',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    expect(response.getMessageArgsList()[0].getNumberValue()).to.equal(2);
  });

  it('should respond with fail if marketo skips creation of lead', async () => {
    const expectedMessage: string  = 'Failed to create or update 1 leads';
    clientWrapperStub.bulkCreateOrUpdateLead.returns(Promise.resolve([{
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
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
        },
        2: {
          email: 'sampleEmail2@example.com',
        },
        3: {
          email: 'sampleEmail3@example.com',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
    expect(response.getMessageArgsList()[0].getNumberValue()).to.equal(1);
  });

  it('should respond with an error if the marketo throws an error', async () => {
    clientWrapperStub.bulkCreateOrUpdateLead.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      leads: {
        1: {
          email: 'sampleEmail1@example.com',
        },
        2: {
          email: 'sampleEmail2@example.com',
        },
        3: {
          email: 'sampleEmail3@example.com',
        },
      },
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
