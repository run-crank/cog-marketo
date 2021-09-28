import { ClientWrapper } from '../client/client-wrapper';
import { promisify } from 'util';
import * as redis from 'redis';
​​
class CachingClientWrapper {
  // cachePrefix is scoped to the specific scenario, request, and requestor
  private cachePrefix = this.idMap.requestId + this.idMap.scenarioId + this.idMap.requestorId;
  private redisClient: any;
  public getAsync: any;
  public setAsync: any;
  public delAsync: any;

  constructor(private client: ClientWrapper, public redisUrl: any, public idMap: any) {
    if (redisUrl) {
      this.redisClient = redis.createClient(redisUrl);
    } else {
      this.redisClient = redis.createClient();
    }
    this.idMap = idMap;
    this.getAsync = promisify(this.redisClient.get).bind(this.redisClient);
    this.setAsync = promisify(this.redisClient.setex).bind(this.redisClient);
    this.delAsync = promisify(this.redisClient.del).bind(this.redisClient);
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
    const stored = await this.getCache(cachekey);
    // if not there, call findLeadByEmail in lead-aware.ts
    if (stored) {
      return stored;
    } else {
      const newLead = await this.client.findLeadByEmail(email, justInCaseField, partitionId);
      await this.setCache(cachekey, newLead);
      return newLead;
    }
  }
​
  public async findLeadByField(field: string, value: string, justInCaseField: string = null, partitionId: number = null) {
    const cachekey = `${this.cachePrefix}Lead${value}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call findLeadByField in lead-aware.ts
    if (stored) {
      return stored;
    } else {
      const newLead = await this.client.findLeadByField(field, value, justInCaseField, partitionId);
      await this.setCache(cachekey, newLead);
      return newLead;
    }
  }

  public async createOrUpdateLead(lead: Record<string, any>, partitionId: number = 1) {
    // making request as normal
    const newLead = await this.client.createOrUpdateLead(lead, partitionId);
    const id = newLead ? newLead.result[0].id : null;
    // deleting cache
    await this.deleteLeadCache(this.cachePrefix, lead.email, id);
    await this.deleteDescriptionCache(this.cachePrefix, lead.email);
    return newLead;
  }
​
  public async deleteLeadById(leadId: number, email: string = null) {
    // deleting cache
    await this.deleteLeadCache(this.cachePrefix, email, leadId);
    await this.deleteDescriptionCache(this.cachePrefix, email);
    // also calling real delete method
    return await this.client.deleteLeadById(leadId);
  }

  public async describeLeadFields(email: string = '') {
    const cachekey = `${this.cachePrefix}Description${email}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call describeLeadFields in lead-aware.ts
    if (stored) {
      return stored;
    } else {
      const newLeadDescription = await this.client.describeLeadFields();
      await this.setCache(cachekey, newLeadDescription);
      return newLeadDescription;
    }
  }

  // custom-object-aware methods
  // -------------------------------------------------------------------
  // Custom Objects will be cached with cacheKey = cachePrefix + 'Object' + email + customObjectName
  // Custom Object Queries will be cached with cacheKey = cachePrefix + 'Query' + email + customObjectName

  public async getCustomObject(customObjectName, email: string = null) {
    const cachekey = `${this.cachePrefix}Object${email + customObjectName}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call getCustomObject in custom-object-aware.ts
    if (stored) {
      return stored;
    } else {
      const newCustomObject = await this.client.getCustomObject(customObjectName);
      await this.setCache(cachekey, newCustomObject);
      return newCustomObject;
    }
  }

  public async queryCustomObject(customObjectName, filterType, searchFields: any[], requestFields: string[] = [], email: string = '') {
    const cachekey = `${this.cachePrefix}Query${email}${customObjectName}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call queryCustomObject in custom-object-aware.ts
    if (stored) {
      return stored;
    } else {
      const newCustomObjectQuery = await this.client.queryCustomObject(customObjectName, filterType, searchFields, requestFields);
      await this.setCache(cachekey, newCustomObjectQuery);
      return newCustomObjectQuery;
    }
  }

  public async createOrUpdateCustomObject(customObjectName, customObject: Record<string, any>) {
    // making request as normal
    const newObject = await this.client.createOrUpdateCustomObject(customObjectName, customObject);
    // deleting cache
    await this.deleteCustomObjectCache(this.cachePrefix, customObject.linkField, customObjectName);
    await this.deleteDescriptionCache(this.cachePrefix, customObject.linkField);
    return newObject;
  }

  public async deleteCustomObjectById(customObjectName, customObjectGUID, email: string = '') {
    await this.deleteCustomObjectCache(this.cachePrefix, email, customObjectName);
    await this.deleteDescriptionCache(this.cachePrefix, email);
    await this.deleteQueryCache(this.cachePrefix, email, customObjectName);
    return await this.client.deleteCustomObjectById(customObjectName, customObjectGUID);
  }

  // smart-campaign-aware methods
  // -------------------------------------------------------------------
  // Campaigns will be cached with cacheKey = cachePrefix + 'Campaigns'

  public async getCampaigns() {
    const cachekey = `${this.cachePrefix}Campaigns`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call getCampaigns in smart-campaign-aware.ts
    if (stored) {
      return stored;
    } else {
      const campaigns = await this.client.getCampaigns();
      await this.setCache(cachekey, campaigns);
      return campaigns;
    }
  }

  // all non-cached functions, just referencing the original function
  // -------------------------------------------------------------------

  public async addLeadToSmartCampaign(campaignId: string, lead: Record<string, any>) {
    return await this.client.addLeadToSmartCampaign(campaignId, lead);
  }

  public async getActivityTypes() {
    return await this.client.getActivityTypes();
  }

  public async getActivityPagingToken(sinceDate) {
    return await this.client.getActivityPagingToken(sinceDate);
  }

  public async getActivities(nextPageToken, leadId, activityId) {
    return await this.client.getActivities(nextPageToken, leadId, activityId);
  }

  public async getDailyApiUsage() {
    return await this.client.getDailyApiUsage();
  }

  public async getWeeklyApiUsage() {
    return await this.client.getWeeklyApiUsage();
  }

  // Redis methods for get, set, and delete
  // -------------------------------------------------------------------

  // Async getter/setter
  public async getCache(key: string) {
    try {
      const stored = await this.getAsync(key);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (err) {
      console.log(err);
    }
  }

  public async setCache(key: string, value: any) {
    try {
      await this.setAsync(key, 600, JSON.stringify(value));
    } catch (err) {
      console.log(err);
    }
  }
  ​
  public async deleteLeadCache(prefix: string, email: string, id: number) {
    // delete all stored leads that match the prefix
    try {
      await this.delAsync(`${prefix}Lead${email}`);
      await this.delAsync(`${prefix}Lead${id}`);
    } catch (err) {
      console.log(err);
    }
  }

  public async deleteDescriptionCache(prefix: string, email: string) {
    try {
      await this.delAsync(`${prefix}Description${email}`);
    } catch (err) {
      console.log(err);
    }
  }
  ​
  public async deleteCustomObjectCache(prefix: string, email: string, customObjectName: string) {
    try {
      await this.delAsync(`${prefix}Object${email}${customObjectName}`);
    } catch (err) {
      console.log(err);
    }
  }

  public async deleteQueryCache(prefix: string, email: string, customObjectName: string) {
    try {
      await this.delAsync(`${prefix}Query${email}${customObjectName}`);
    } catch (err) {
      console.log(err);
    }
  }
}
​
export { CachingClientWrapper as CachingClientWrapper };
