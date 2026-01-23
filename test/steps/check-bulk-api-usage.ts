import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/check-bulk-api-usage';

chai.use(sinonChai);

describe('CheckBulkApiUsageStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.getBulkExportLeadJobs = sinon.stub();
    clientWrapperStub.getBulkExportActivityJobs = sinon.stub();
    clientWrapperStub.getBulkExportProgramMemberJobs = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CheckBulkApiUsageStep');
    expect(stepDef.getName()).to.equal('Check daily Marketo Bulk API usage');
    expect(stepDef.getExpression()).to.equal('there should be less than 90% usage of your daily bulk API limit');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  it('should respond with success if bulk API usage is less than 90% of the daily limit', async () => {
    const expectedLimit: number = 500; // 500MB default
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    protoStep.setData(Struct.fromJavaScript({
      exportLimit: expectedLimit,
    }));
    
    // Mock lead export jobs - 100MB used today
    clientWrapperStub.getBulkExportLeadJobs.returns(Promise.resolve({
      success: true,
      result: [
        {
          createdAt: today.toISOString(),
          status: 'Completed',
          fileSize: 100 * 1024 * 1024, // 100MB
        },
      ],
    }));
    
    // Mock activity export jobs - 50MB used today
    clientWrapperStub.getBulkExportActivityJobs.returns(Promise.resolve({
      success: true,
      result: [
        {
          createdAt: today.toISOString(),
          status: 'Completed',
          fileSize: 50 * 1024 * 1024, // 50MB
        },
      ],
    }));
    
    // Mock program member export jobs - empty
    clientWrapperStub.getBulkExportProgramMemberJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with a failure if bulk API usage is more than 90% of the daily limit', async () => {
    const expectedLimit: number = 500;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    protoStep.setData(Struct.fromJavaScript({
      exportLimit: expectedLimit,
    }));
    
    // Mock lead export jobs - 400MB used today
    clientWrapperStub.getBulkExportLeadJobs.returns(Promise.resolve({
      success: true,
      result: [
        {
          createdAt: today.toISOString(),
          status: 'Completed',
          fileSize: 400 * 1024 * 1024, // 400MB
        },
      ],
    }));
    
    // Mock activity export jobs - 100MB used today
    clientWrapperStub.getBulkExportActivityJobs.returns(Promise.resolve({
      success: true,
      result: [
        {
          createdAt: today.toISOString(),
          status: 'Completed',
          fileSize: 100 * 1024 * 1024, // 100MB
        },
      ],
    }));
    
    // Mock program member export jobs - empty
    clientWrapperStub.getBulkExportProgramMemberJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
  });

  it('should only count jobs from today', async () => {
    const expectedLimit: number = 500;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    protoStep.setData(Struct.fromJavaScript({
      exportLimit: expectedLimit,
    }));
    
    // Mock lead export jobs - one from today (50MB), one from yesterday (400MB)
    clientWrapperStub.getBulkExportLeadJobs.returns(Promise.resolve({
      success: true,
      result: [
        {
          createdAt: today.toISOString(),
          status: 'Completed',
          fileSize: 50 * 1024 * 1024, // 50MB today
        },
        {
          createdAt: yesterday.toISOString(),
          status: 'Completed',
          fileSize: 400 * 1024 * 1024, // 400MB yesterday (should not count)
        },
      ],
    }));
    
    clientWrapperStub.getBulkExportActivityJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    clientWrapperStub.getBulkExportProgramMemberJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    // Should pass because only 50MB from today counts
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should only count completed jobs', async () => {
    const expectedLimit: number = 500;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    protoStep.setData(Struct.fromJavaScript({
      exportLimit: expectedLimit,
    }));
    
    // Mock lead export jobs - one completed (50MB), one queued (400MB)
    clientWrapperStub.getBulkExportLeadJobs.returns(Promise.resolve({
      success: true,
      result: [
        {
          createdAt: today.toISOString(),
          status: 'Completed',
          fileSize: 50 * 1024 * 1024, // 50MB completed
        },
        {
          createdAt: today.toISOString(),
          status: 'Queued',
          fileSize: 400 * 1024 * 1024, // 400MB queued (should not count)
        },
      ],
    }));
    
    clientWrapperStub.getBulkExportActivityJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    clientWrapperStub.getBulkExportProgramMemberJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    // Should pass because only 50MB from completed jobs counts
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should handle empty results', async () => {
    const expectedLimit: number = 500;
    
    protoStep.setData(Struct.fromJavaScript({
      exportLimit: expectedLimit,
    }));
    
    clientWrapperStub.getBulkExportLeadJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    clientWrapperStub.getBulkExportActivityJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    clientWrapperStub.getBulkExportProgramMemberJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    // Should pass with 0MB usage
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });

  it('should respond with an error if the marketo client throws an error', async () => {
    clientWrapperStub.getBulkExportLeadJobs.throws('any error');
    protoStep.setData(Struct.fromJavaScript({
      exportLimit: 500,
    }));
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should use default limit of 500MB when not specified', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Don't set exportLimit, should default to 500MB
    protoStep.setData(Struct.fromJavaScript({}));
    
    clientWrapperStub.getBulkExportLeadJobs.returns(Promise.resolve({
      success: true,
      result: [
        {
          createdAt: today.toISOString(),
          status: 'Completed',
          fileSize: 400 * 1024 * 1024, // 400MB
        },
      ],
    }));
    
    clientWrapperStub.getBulkExportActivityJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    clientWrapperStub.getBulkExportProgramMemberJobs.returns(Promise.resolve({
      success: true,
      result: [],
    }));
    
    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    // Should pass because 400MB < 90% of 500MB (450MB)
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });
});
