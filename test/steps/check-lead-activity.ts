import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/check-lead-activity';

chai.use(sinonChai);

describe('DeleteLeadStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByEmail = sinon.stub();
    clientWrapperStub.getActivityPagingToken = sinon.stub();
    clientWrapperStub.getActivityTypes = sinon.stub();
    clientWrapperStub.getActivities = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CheckLeadActivityStep');
    expect(stepDef.getName()).to.equal('Check a Marketo Lead\'s Activity');
    expect(stepDef.getExpression()).to.equal('there should be an? (?<activityTypeIdOrName>.+) activity for marketo lead (?<email>.+) in the last (?<minutes>\\d+) minutes?');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  describe('executeStep', () => {
    describe('Lead not found', () => {
      const expectedEmail = 'test@thisisjust.atomatest.com';
      const expectedActivityTypeIdOrName = 'Lead created';
      const expectedMinutes = 15;
      beforeEach(() => {
        protoStep.setData(Struct.fromJavaScript({
          email: expectedEmail,
          activityTypeIdOrName: expectedActivityTypeIdOrName,
          minutes: expectedMinutes,
        }));

        clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
          nextPageToken: 'abc123',
        }));

        clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
          result: [],
        }));
      });

      it('should respond with error', async () => {
        const response = await stepUnderTest.executeStep(protoStep);
        expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
      });
    });

    describe('On exception', () => {
      const expectedEmail = 'test@thisisjust.atomatest.com';
      const expectedActivityTypeIdOrName = 'Lead created';
      const expectedMinutes = 15;
      beforeEach(() => {
        protoStep.setData(Struct.fromJavaScript({
          email: expectedEmail,
          activityTypeIdOrName: expectedActivityTypeIdOrName,
          minutes: expectedMinutes,
        }));

        clientWrapperStub.getActivityPagingToken.throws();
      });

      it('should respond with error', async () => {
        const response = await stepUnderTest.executeStep(protoStep);
        expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
      });
    });

    describe('Activity Type not found', () => {
      const expectedEmail = 'test@thisisjust.atomatest.com';
      const expectedActivityTypeIdOrName = 'Lead created';
      const expectedMinutes = 15;
      beforeEach(() => {
        protoStep.setData(Struct.fromJavaScript({
          email: expectedEmail,
          activityTypeIdOrName: expectedActivityTypeIdOrName,
          minutes: expectedMinutes,
        }));

        clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
          nextPageToken: 'abc123',
        }));

        clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
          result: [{}],
        }));

        clientWrapperStub.getActivityTypes.returns(Promise.resolve({
          result: [{ id: 1, name: 'New lead' }],
        }));
      });

      it('should respond with error', async () => {
        const response = await stepUnderTest.executeStep(protoStep);
        expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
      });
    });

    describe('No activities found for activity type', () => {
      const expectedEmail = 'test@thisisjust.atomatest.com';
      const expectedActivityTypeIdOrName = 'Lead created';
      const expectedMinutes = 15;
      beforeEach(() => {
        protoStep.setData(Struct.fromJavaScript({
          email: expectedEmail,
          activityTypeIdOrName: expectedActivityTypeIdOrName,
          minutes: expectedMinutes,
        }));

        clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
          nextPageToken: 'abc123',
        }));

        clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
          result: [{ id: 10001 }],
        }));

        clientWrapperStub.getActivityTypes.returns(Promise.resolve({
          result: [{ id: 2001, name: 'Lead created' }],
        }));

        clientWrapperStub.getActivities.returns(Promise.resolve({}));
      });

      it('should respond with fail', async () => {
        const response = await stepUnderTest.executeStep(protoStep);
        expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      });
    });

    describe('Activities found. withAttributes is not supplied', () => {
      const expectedEmail = 'test@thisisjust.atomatest.com';
      const expectedActivityTypeIdOrName = 'Lead created';
      const expectedMinutes = 15;
      beforeEach(() => {
        protoStep.setData(Struct.fromJavaScript({
          email: expectedEmail,
          activityTypeIdOrName: expectedActivityTypeIdOrName,
          minutes: expectedMinutes,
        }));

        clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
          nextPageToken: 'abc123',
        }));

        clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
          result: [{ id: 10001 }],
        }));

        clientWrapperStub.getActivityTypes.returns(Promise.resolve({
          result: [{ id: 2001, name: 'Lead created' }],
        }));

        clientWrapperStub.getActivities.returns(Promise.resolve({
          result: [],
        }));
      });

      it('should respond with pass', async () => {
        const response = await stepUnderTest.executeStep(protoStep);
        expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      });
    });

    describe('Expected Attributes Matching', () => {
      const expectedEmail = 'test@thisisjust.atomatest.com';
      const expectedActivityTypeIdOrName = 'Lead created';
      const expectedMinutes = 15;
      beforeEach(() => {
        protoStep.setData(Struct.fromJavaScript({
          email: expectedEmail,
          activityTypeIdOrName: expectedActivityTypeIdOrName,
          minutes: expectedMinutes,
        }));

        clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
          nextPageToken: 'abc123',
        }));

        clientWrapperStub.findLeadByEmail.returns(Promise.resolve({
          result: [{ id: 10001 }],
        }));

        clientWrapperStub.getActivityTypes.returns(Promise.resolve({
          result: [{ id: 2001, name: 'Lead created', primaryAttribute: { name: 'primaryAttribute' } }],
        }));

        clientWrapperStub.getActivities.returns(Promise.resolve({
          result: [{
            activityTypeId: 2001,
            primaryAttribute: { name: 'primaryAttribute' },
            primaryAttributeValue: 'primaryAttributeValue',
            attributes: [
              { name: 'attribute1', value: 'attribute1' },
            ],
          }],
        }));
      });

      describe('Has at least one match', () => {
        beforeEach(() => {
          protoStep.setData(Struct.fromJavaScript({
            email: expectedEmail,
            activityTypeIdOrName: expectedActivityTypeIdOrName,
            minutes: expectedMinutes,
            withAttributes: {
              attribute1: 'attribute1',
            },
          }));
        });

        it('should respond with pass', async () => {
          const response = await stepUnderTest.executeStep(protoStep);
          expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
        });
      });

      describe('Has no matches', () => {
        beforeEach(() => {
          protoStep.setData(Struct.fromJavaScript({
            email: expectedEmail,
            activityTypeIdOrName: expectedActivityTypeIdOrName,
            minutes: expectedMinutes,
            withAttributes: {
              nonExistentAttribute: 'I dont exist',
            },
          }));
        });

        it('should respond with fail', async () => {
          const response = await stepUnderTest.executeStep(protoStep);
          expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
        });
      });

      describe('Primary attribute is matching', () => {
        beforeEach(() => {
          protoStep.setData(Struct.fromJavaScript({
            email: expectedEmail,
            activityTypeIdOrName: expectedActivityTypeIdOrName,
            minutes: expectedMinutes,
            withAttributes: {
              primaryAttribute: 'primaryAttributeValue',
            },
          }));
        });

        it('should respond with pass', async () => {
          const response = await stepUnderTest.executeStep(protoStep);
          expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
        });
      });
    });
  });
});
