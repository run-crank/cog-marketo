import { ClientWrapper } from '../client/client-wrapper';
import { promisify } from 'util';
​​
class CachingClientWrapper {
  // cachePrefix is scoped to the specific scenario, request, and requestor
  private cachePrefix = this.idMap.requestId + this.idMap.scenarioId + this.idMap.requestorId;

  constructor(private client: ClientWrapper, public redisClient: any, public idMap: any) {
    this.redisClient = redisClient;
    this.idMap = idMap;
  }
​
  // lead-aware methods
  // -------------------------------------------------------------------
  // Leads will be cached with one of the following cache key structures:
  //  1) When a lead is found by email, the cacheKey = cachePrefix + 'Lead' + email
  //  2) When a lead is found by id number, the cacheKey = cachePrefix + 'Lead' + leadId
  //
  // Lead descriptions will be cached with the cacheKey = cachePrefix + 'Description' + email
  //
  // If a lead is deleted, then all three of the cacheKeys mentioned above are deleted from Redis.
​
  public async findLeadByEmail(email: string, justInCaseField: string = null, partitionId: number = null) {
    const cachekey = `${this.cachePrefix}Lead${email}`;
    // check cache
    const stored = await getCache.call(this, cachekey);
    // if not there, call findLeadByEmail in lead-aware.ts
    if (stored) {
      console.log('Lead found in cache by email')
      return stored;
    } else {
      console.log('Lead not found in cache by email...');
      const newLead = await this.client.findLeadByEmail(email, justInCaseField, partitionId);
      await setCache.call(this, cachekey, newLead);
      return newLead;
    }
  }
​
  public async findLeadByField(field: string, value: string, justInCaseField: string = null, partitionId: number = null) {
    const cachekey = `${this.cachePrefix}Lead${value}`;
    // check cache
    const stored = await getCache.call(this, cachekey);
    // if not there, call findLeadByField in lead-aware.ts
    if (stored) {
      console.log('Lead found in cache by ID')
      return stored;
    } else {
      console.log('Lead not found in cache by ID...');
      const newLead = await this.client.findLeadByField(field, value, justInCaseField, partitionId);
      await setCache.call(this, cachekey, newLead);
      return newLead;
    }
  }

  public async createOrUpdateLead(lead: Record<string, any>, partitionId: number = 1) {   
    // making request as normal
    const newLead = await this.client.createOrUpdateLead(lead, partitionId)
    // deleting cache
    await deleteLeadCache.call(this, this.cachePrefix, lead.email, newLead.result[0].id);
    await deleteDescriptionCache.call(this, this.cachePrefix, lead.email)
    return newLead;
  }
​
  public async deleteLeadById(leadId: number, email: string) {
    // deleting cache
    await deleteLeadCache.call(this, this.cachePrefix, email, leadId);
    await deleteDescriptionCache.call(this, this.cachePrefix, email)

    // also calling real delete method
    return await this.client.deleteLeadById(leadId)
  }

  public async describeLeadFields(email: string = '') {
    const cachekey = `${this.cachePrefix}Description${email}`;
    // check cache
    const stored = await getCache.call(this, cachekey);
    // if not there, call describeLeadFields in lead-aware.ts
    if (stored) {
      console.log('Lead Description found in cache...')
      return stored;
    } else {
      console.log('Lead Description not found in cache...');
      const newLeadDescription = await this.client.describeLeadFields();
      await setCache.call(this, cachekey, newLeadDescription);
      return newLeadDescription;
    }
  }

  // custom-object-aware methods
  // -------------------------------------------------------------------
  // Custom Objects will be cached with cacheKey = cachePrefix + 'Object' + email + customObjectName
  // Custom Object Queries will be cached with cacheKey = cachePrefix + 'Query' + email + customObjectName

  public async createOrUpdateCustomObject(customObjectName, customObject: Record<string, any>) {
    // making request as normal
    const newObject = await this.client.createOrUpdateCustomObject(customObjectName, customObject);
    // deleting cache
    await deleteCustomObjectCache.call(this, this.cachePrefix, customObject.linkField, customObjectName);
    await deleteDescriptionCache.call(this, this.cachePrefix, customObject.linkField);
    return newObject;
  }

  public async getCustomObject(customObjectName, email: string = null) {
    const cachekey = `${this.cachePrefix}Object${email + customObjectName}`;
    // check cache
    const stored = await getCache.call(this, cachekey);
    // if not there, call getCustomObject in custom-object-aware.ts
    if (stored) {
      console.log('Custom Object found in cache...')
      return stored;
    } else {
      console.log('Custom Object not found in cache...');
      const newCustomObject = await this.client.getCustomObject(customObjectName);
      await setCache.call(this, cachekey, newCustomObject);
      return newCustomObject;
    }
  }

  public async queryCustomObject(customObjectName, filterType, searchFields: any[], requestFields: string[] = [], email: string = '') {
    const cachekey = `${this.cachePrefix}Query${email}${customObjectName}`;
    // check cache
    const stored = await getCache.call(this, cachekey);
    // if not there, call queryCustomObject in custom-object-aware.ts
    if (stored) {
      console.log('Query found in cache...')
      return stored;
    } else {
      console.log('Query not found in cache...');
      const newCustomObjectQuery = await this.client.queryCustomObject(customObjectName, filterType, searchFields, requestFields);
      await setCache.call(this, cachekey, newCustomObjectQuery);
      return newCustomObjectQuery;
    }
  }

  public async deleteCustomObjectById(customObjectName, customObjectGUID, email: string = '') {
    await deleteCustomObjectCache.call(this, this.cachePrefix, email, customObjectName);
    await deleteDescriptionCache.call(this, this.cachePrefix, email);
    await deleteQueryCache.call(this, this.cachePrefix, email, customObjectName);
    return await this.client.deleteCustomObjectById(customObjectName, customObjectGUID);
  }

  // smart-campaign-aware methods
  // -------------------------------------------------------------------

  public async getCampaigns() {
    const cachekey = `${this.cachePrefix}Campaigns`;
    // check cache
    const stored = await getCache.call(this, cachekey);
    // if not there, call getCustomObject in custom-object-aware.ts
    if (stored) {
      console.log('Campaigns found in cache...')
      return stored;
    } else {
      console.log('Campaigns not found in cache...');
      const campaigns = await this.client.getCampaigns();
      await setCache.call(this, cachekey, campaigns);
      return campaigns;
    }
  }

  // all non-cached functions, just refenceing the original function
  // -------------------------------------------------------------------

  public async addLeadToSmartCampaign(campaignId: string, lead: Record<string, any>) {
    return this.client.addLeadToSmartCampaign(campaignId, lead);
  }


  

}



​
// Redis methods for get, set, and delete
// -------------------------------------------------------------------
async function getCache(key: string) {
  this.redisClient.get = promisify(this.redisClient.get);
  try {
    const stored = await this.redisClient.get(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (err) {
    console.log(err);
  }
}

async function setCache(key: string, value: any) {
  this.redisClient.setex = promisify(this.redisClient.setex);
  try {
    await this.redisClient.setex(key, 600, JSON.stringify(value));
    console.log('stored data in cache');
  } catch (err) {
    console.log(err);
  }
}
​
async function deleteLeadCache(prefix: string, email: string, id: string) {
  this.redisClient.del = promisify(this.redisClient.del);
  // delete all stored leads that match the prefix
  try {
    await this.redisClient.del(`${prefix}Lead${email}`);
    await this.redisClient.del(`${prefix}Lead${id}`);
    console.log('deleted Lead data from cache');
  } catch (err) {
    console.log(err);
  }
}

async function deleteDescriptionCache(prefix: string, email: string) {
  this.redisClient.del = promisify(this.redisClient.del);
  try {
    await this.redisClient.del(`${prefix}Description${email}`);
    console.log('deleted Lead Descripton data from cache');
  } catch (err) {
    console.log(err);
  }
}
​
async function deleteCustomObjectCache(prefix: string, email: string, customObjectName: string) {
  this.redisClient.del = promisify(this.redisClient.del);
  try {
    await this.redisClient.del(`${prefix}Object${email}${customObjectName}`);
    console.log('deleted Custom Object data from cache');
  } catch (err) {
    console.log(err);
  }
}

async function deleteQueryCache(prefix: string, email: string, customObjectName: string) {
  this.redisClient.del = promisify(this.redisClient.del);
  try {
    await this.redisClient.del(`${prefix}Query${email}${customObjectName}`);
    console.log('deleted Query data from cache');
  } catch (err) {
    console.log(err);
  }
}
​
export { CachingClientWrapper as CachingClientWrapper };
