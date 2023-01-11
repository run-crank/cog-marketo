import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/lead-merge';

chai.use(sinonChai);

describe('MergeLeadsStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByField = sinon.stub();
    clientWrapperStub.mergeLeadsById = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('MergeLeadsStep');
    expect(stepDef.getName()).to.equal('Merge Marketo leads');
    expect(stepDef.getExpression()).to.equal('merge marketo lead (?<losingEmail>.+\@.+\..+) into marketo lead (?<winningEmail>.+\@.+\..+)');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // losingEmail field
    expect(fields[0].key).to.equal('losingEmail');
    expect(fields[0].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[0].type).to.equal(FieldDefinition.Type.STRING);

    // winningEmail field
    expect(fields[1].key).to.equal('winningEmail');
    expect(fields[1].optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(fields[1].type).to.equal(FieldDefinition.Type.STRING);

    // Partition ID field
    expect(fields[2].key).to.equal('partitionId');
    expect(fields[2].optionality).to.equal(FieldDefinition.Optionality.OPTIONAL);
    expect(fields[2].type).to.equal(FieldDefinition.Type.NUMERIC);
  });

  it('should call the client wrapper with the expected args', async () => {
    const expectedEmail1: string = 'expected1@example.com';
    const expectedEmail2: string = 'expected2@example.com';
    const expectedId1: string = '1';
    const expectedId2: string = '1';
    const expectedPartitionId: number = 3;
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [
        { id: '1' },
      ],
    }));
    protoStep.setData(Struct.fromJavaScript({
      losingEmail: expectedEmail1,
      winningEmail: expectedEmail2,
      partitionId: expectedPartitionId,
    }));

    await stepUnderTest.executeStep(protoStep);
    expect(clientWrapperStub.findLeadByField).to.have.been.calledWith(
      'email',
      expectedEmail1,
      null,
      expectedPartitionId,
    );
    expect(clientWrapperStub.findLeadByField).to.have.been.calledWith(
      'email',
      expectedEmail2,
      null,
      expectedPartitionId,
    );
    expect(clientWrapperStub.mergeLeadsById).to.have.been.calledWith(
      expectedId1,
      [expectedId2],
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

  it('should respond with an error if Marketo fails to merge the leads', async () => {
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [{
        id: '1',
      }],
    }));

    clientWrapperStub.mergeLeadsById.returns(Promise.resolve({
      success: false,
      result: [],
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with a pass if the leads are successfully merged', async () => {
    const expectedEmail1: string = 'expected1@example.com';
    const expectedEmail2: string = 'expected2@example.com';
    const expectedPartitionId: number = 3;
    clientWrapperStub.findLeadByField.returns(Promise.resolve({
      success: true,
      result: [
        { 
          id: '1', 
          email: expectedEmail1,
        },
      ],
    }));
    clientWrapperStub.mergeLeadsById.returns(Promise.resolve({
      success: true,
      requestId: '123',
    }));
    protoStep.setData(Struct.fromJavaScript({
      losingEmail: expectedEmail1,
      winningEmail: expectedEmail2,
      partitionId: expectedPartitionId,
    }));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
  });
});
