import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/check-lead-activity';

chai.use(sinonChai);

describe('CheckLeadActivityStep', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let clientWrapperStub: any;

  beforeEach(() => {
    protoStep = new ProtoStep();
    clientWrapperStub = sinon.stub();
    clientWrapperStub.findLeadByField = sinon.stub();
    clientWrapperStub.getActivityPagingToken = sinon.stub();
    clientWrapperStub.getActivityTypes = sinon.stub();
    clientWrapperStub.getActivitiesByLeadId = sinon.stub();
    clientWrapperStub.bulkFindLeadsByEmail = sinon.stub();
    stepUnderTest = new Step(clientWrapperStub);
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CheckLeadActivityStep');
    expect(stepDef.getName()).to.equal('Check a Marketo Lead\'s Activity');
    expect(stepDef.getExpression()).to.equal('there should (?<includes>not include|be|not be) an? (?<activityTypeIdOrName>.+) activity for marketo lead (?<email>.+) in the last (?<minutes>\\d+) minutes?');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.VALIDATION);
  });

  // for a single lead
  describe('Execute Step', () => {
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

        clientWrapperStub.findLeadByField.returns(Promise.resolve({
          result: [],
        }));
        
        clientWrapperStub.getActivityTypes.returns(Promise.resolve({
          result: [{ id: 1, name: 'Lead created' }],
        }));
      });

      it('should respond with fail', async () => {
        const response = await stepUnderTest.executeStep(protoStep);
        expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
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

        clientWrapperStub.findLeadByField.returns(Promise.resolve({
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

        clientWrapperStub.findLeadByField.returns(Promise.resolve({
          result: [{ id: 10001 }],
        }));

        clientWrapperStub.getActivityTypes.returns(Promise.resolve({
          result: [{ id: 2001, name: 'Lead created' }],
        }));

        clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
          result: []
        }));
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

        clientWrapperStub.findLeadByField.returns(Promise.resolve({
          result: [{ id: 10001 }],
        }));

        clientWrapperStub.getActivityTypes.returns(Promise.resolve({
          result: [{ id: 2001, name: 'Lead created' }],
        }));

        clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
          result: [{ id: 3001, attributes: [] }],
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

        clientWrapperStub.findLeadByField.returns(Promise.resolve({
          result: [{ id: 10001 }],
        }));

        clientWrapperStub.getActivityTypes.returns(Promise.resolve({
          result: [{ id: 2001, name: 'Lead created', primaryAttribute: { name: 'primaryAttribute' } }],
        }));

        clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
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
  
  // for multiple leads
  describe('Execute Bulk Step', () => {
    
    it('should respond with error when Marketo request fails', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));
      
      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        success: false
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
            
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
      expect(response.toObject().messageFormat).to.contain('There was an error finding the leads in Marketo');
    });
    
    it('should respond with fail when any leads are not found', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));
      
      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{}],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      expect(response.toObject().messageFormat).to.contain('Not all leads were found')
    });
    
    it('should respond with error when Activity Type is not found', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{ id: 10001 },{ id: 10002 }],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [],
      }));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
    });
    
    it('should respond with fail when no activities are found for any leads', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{ id: 10001 },{ id: 10002 }],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
        result: [],
      }));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      expect(response.toObject().messageFormat).to.contain('No %s activity found for the provided leads within the last %d minute(s)');
    });
    
    it('should respond with pass when activities are found for all leads', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{ id: 10001 },{ id: 10002 }],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
        result: [{id: 1, leadId: 10001, activityDate: 'fakeDate', activityTypeId: 1000}, {id: 2, leadId: 10002, activityDate: 'fakeDate', activityTypeId: 1000}],
      }));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Found %s activity for all leads within the last %d minute(s)');
    });
    
    it('should respond with fail when activities are not found for some leads', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{ id: 10001 },{ id: 10002 }],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
        result: [{id: 1, leadId: 10001, activityDate: 'fakeDate', activityTypeId: 1000}],
      }));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      expect(response.toObject().messageFormat).to.contain('Found %s activity for %d out of %d leads within the last %d minute(s)');
    });
    
    it('should respond with fail when activities are not found for any leads', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{ id: 10001 },{ id: 10002 }],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
        result: [{id: 1, leadId: 'wrongId', activityDate: 'fakeDate', activityTypeId: 1000}],
      }));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      expect(response.toObject().messageFormat).to.contain('Did not find %s activity for any leads within the last %d minute(s)');
    });
    
    it('should respond with fail when correct activities are found, but attributes are missing for some leads', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        withAttributes: {'New Value': 'exampleVal'},
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{ id: 10001 },{ id: 10002 }],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
        result: [{id: 1, 
                  leadId: 10001, 
                  activityDate: 'fakeDate', 
                  activityTypeId: 1000,
                  primaryAttribute: { name: 'primaryAttribute' },
                  primaryAttributeValue: 'primaryAttributeValue',
                  attributes: [
                    { name: 'New Value', value: 'exampleVal' },
                  ],
                }, {id: 2, 
                  leadId: 10002, 
                  activityDate: 'fakeDate', 
                  activityTypeId: 1000,
                  primaryAttribute: { name: 'primaryAttribute' },
                  primaryAttributeValue: 'primaryAttributeValue',
                  attributes: [
                    { name: 'attribute1', value: 'attribute1' },
                  ],
                }]}));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      expect(response.toObject().messageFormat).to.contain('Found %s activity for %d out of %d leads within the last %d minute(s), including attributes: \n\n%s');
    });
    
    it('should respond with fail when correct activities are found, but attributes are missing for all leads', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        withAttributes: {'New Value': 'exampleVal'},
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{ id: 10001 },{ id: 10002 }],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
        result: [{id: 1, 
                  leadId: 10001, 
                  activityDate: 'fakeDate', 
                  activityTypeId: 1000,
                  primaryAttribute: { name: 'primaryAttribute' },
                  primaryAttributeValue: 'primaryAttributeValue',
                  attributes: [
                    { name: 'attribute1', value: 'attribute1' },
                  ],
                }, {id: 2, 
                  leadId: 10002, 
                  activityDate: 'fakeDate', 
                  activityTypeId: 1000,
                  primaryAttribute: { name: 'primaryAttribute' },
                  primaryAttributeValue: 'primaryAttributeValue',
                  attributes: [
                    { name: 'attribute1', value: 'attribute1' },
                  ],
                }]}));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.FAILED);
      expect(response.toObject().messageFormat).to.contain('Did not find %s activity for any leads within the last %d minute(s) that included attributes: \n\n%s');
    });
    
    it('should respond with pass when correct activities are found for all leads, including attributes', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: ['test@thisisjust.atomatest.com', 'test2@thisisjust.atomatest.com'],
        withAttributes: {'New Value': 'exampleVal'},
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: [{ id: 10001 },{ id: 10002 }],
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
        result: [{id: 1, 
                  leadId: 10001, 
                  activityDate: 'fakeDate', 
                  activityTypeId: 1000,
                  primaryAttribute: { name: 'primaryAttribute' },
                  primaryAttributeValue: 'primaryAttributeValue',
                  attributes: [
                    { name: 'New Value', value: 'exampleVal' },
                  ],
                }, {id: 2, 
                  leadId: 10002, 
                  activityDate: 'fakeDate', 
                  activityTypeId: 1000,
                  primaryAttribute: { name: 'primaryAttribute' },
                  primaryAttributeValue: 'primaryAttributeValue',
                  attributes: [
                    { name: 'New Value', value: 'exampleVal' },
                  ],
                }]}));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Found %s activity for all leads within the last %d minute(s), including attributes: \n\n%s');
    });
    
    it('should respond with pass when testing over 30 leads at once', async () => {
      protoStep.setData(Struct.fromJavaScript({
        email: 'dummyEmail',
        multiple_email: Array(35).fill(0).map((a, idx) => `test${idx}@thisisjust.atomatest.com`),
        withAttributes: {'New Value': 'exampleVal'},
        activityTypeIdOrName: 'Lead created',
        minutes: 15,
      }));

      clientWrapperStub.getActivityPagingToken.returns(Promise.resolve({
        nextPageToken: 'abc123',
      }));

      clientWrapperStub.bulkFindLeadsByEmail.returns(Promise.resolve([{
        result: Array(35).fill(0).map((a, idx) => {return {id: idx}}),
        success: true
      }]));
      
      clientWrapperStub.getActivityTypes.returns(Promise.resolve({
        result: [{ id: 1, name: 'Lead created' }],
      }));
      
      clientWrapperStub.getActivitiesByLeadId.returns(Promise.resolve({
        result: Array(35).fill(0).map((a, idx) => {
          return {id: 1, 
            leadId: idx, 
            activityDate: 'fakeDate', 
            activityTypeId: 1000,
            primaryAttribute: { name: 'primaryAttribute' },
            primaryAttributeValue: 'primaryAttributeValue',
            attributes: [
              { name: 'New Value', value: 'exampleVal' },
            ],
          }
        })
      }));
      
      const response = await stepUnderTest.executeStep(protoStep);
      expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
      expect(response.toObject().messageFormat).to.contain('Found %s activity for all leads within the last %d minute(s), including attributes: \n\n%s');
    });
  });
});
