# Marketo Cog

[![CircleCI](https://circleci.com/gh/run-crank/cog-marketo/tree/master.svg?style=svg)](https://circleci.com/gh/run-crank/cog-marketo/tree/master)

This is a [Crank][what-is-crank] Cog for Marketo, providing steps and
assertions for you to validate the state and behavior of your Marketo
instance.

* [Installation](#installation)
* [Usage](#usage)
* [Development and Contributing](#development-and-contributing)

## Installation

Ensure you have the `crank` CLI and `docker` installed and running locally,
then run the following.  You'll be prompted to enter your Marketo credentials
once the Cog is successfully installed.

```shell-session
$ crank cog:install stackmoxie/marketo
```

Note: You can always re-authenticate later.

## Usage

### Authentication
<!-- authenticationDetails -->
You will be asked for the following authentication details on installation. To avoid prompts in a CI/CD context, you can provide the same details as environment variables.

| Field | Install-Time Environment Variable | Description |
| --- | --- | --- |
| **endpoint** | `CRANK_AUTOMATONINC_MARKETO__ENDPOINT` | REST API endpoint (without /rest), e.g. https://123-abc-456.mktorest.com |
| **clientId** | `CRANK_AUTOMATONINC_MARKETO__CLIENTID` | Client ID |
| **clientSecret** | `CRANK_AUTOMATONINC_MARKETO__CLIENTSECRET` | Client Secret |

```shell-session
# Re-authenticate by running this
$ crank cog:auth stackmoxie/marketo
```
<!-- authenticationDetailsEnd -->

### Steps
<!-- stepDetails -->
| Name (ID) | Expression | Expected Data |
| --- | --- | --- |
| **Check a Marketo Lead's Activity**<br>(`CheckLeadActivityStep`) | `there should be an? (?<activityTypeIdOrName>.+) activity for marketo lead (?<email>.+) in the last (?<minutes>\d+) minutes?` | - `email`: The email address of the Marketo Lead <br><br>- `activityTypeIdOrName`: The activity type ID (number) or name <br><br>- `minutes`: The number of minutes prior to now to use when filtering the activity feed <br><br>- `withAttributes`: Represents additional parameters that should be used to validate an activity. The key in the object represents an attribute name and the value represents the expected value <br><br>- `partitionId`: ID of partition lead belongs to |
| **Create or Update a Marketo Custom Object**<br>(`CreateOrUpdateCustomObjectStep`) | `create or update an? (?<name>.+) marketo custom object linked to lead (?<linkValue>.+)` | - `name`: Custom Object's API name <br><br>- `linkValue`: Linked Lead's email address <br><br>- `customObject`: Map of custom object data whose keys are field names. <br><br>- `partitionId`: ID of partition lead belongs to |
| **Delete a Marketo Custom Object**<br>(`DeleteCustomObjectStep`) | `delete the (?<name>.+) marketo custom object linked to lead (?<linkValue>.+)` | - `name`: Custom Object's API name <br><br>- `linkValue`: Linked Lead's email address <br><br>- `dedupeFields`: Map of custom dedupeFields data whose keys are field names. <br><br>- `partitionId`: ID of partition lead belongs to |
| **Check a field on a Marketo Custom Object**<br>(`CustomObjectFieldEqualsStep`) | `the (?<field>[a-zA-Z0-9_-]+) field on the (?<name>.+) marketo custom object linked to lead (?<linkValue>.+) should (?<operator>be set\|not be set\|be less than\|be greater than\|be one of\|be\|contain\|not be one of\|not be\|not contain) ?(?<expectedValue>.+)?` | - `name`: Custom Object's API name <br><br>- `linkValue`: Linked Lead's email address <br><br>- `field`: Field name to check <br><br>- `operator`: Check Logic (be, not be, contain, not contain, be greater than, be less than, be set, not be set, be one of, or not be one of) <br><br>- `expectedValue`: The expected value of the field <br><br>- `dedupeFields`: Map of custom dedupeFields data whose keys are field names. <br><br>- `partitionId`: ID of partition lead belongs to |
| **Create or update a Marketo Lead**<br>(`CreateOrUpdateLeadByFieldStep`) | `create or update a marketo lead` | - `lead`: A map of field names to field values |
| **Delete a Marketo Lead**<br>(`DeleteLeadStep`) | `delete the (?<email>.+) marketo lead` | - `email`: Lead's email address <br><br>- `partitionId`: ID of partition lead belongs to |
| **Check a field on a Marketo Lead**<br>(`LeadFieldEqualsStep`) | `the (?<field>[a-zA-Z0-9_-]+) field on marketo lead (?<email>.+) should (?<operator>be set\|not be set\|be less than\|be greater than\|be one of\|be\|contain\|not be one of\|not be\|not contain) ?(?<expectation>.+)?` | - `email`: Lead's email address <br><br>- `field`: Field name to check <br><br>- `operator`: Check Logic (be, not be, contain, not contain, be greater than, be less than, be set, not be set, be one of, or not be one of) <br><br>- `expectation`: Expected field value <br><br>- `partitionId`: ID of partition lead belongs to |
| **Add Marketo Lead to Smart Campaign**<br>(`AddLeadToSmartCampaignStep`) | `add the (?<email>.+) marketo lead to smart campaign (?<campaign>.+)` | - `email`: Lead's email address <br><br>- `campaign`: Smart campaign name or numeric id <br><br>- `partitionId`: ID of partition lead belongs to |
<!-- stepDetailsEnd -->

## Development and Contributing
Pull requests are welcome. For major changes, please open an issue first to
discuss what you would like to change. Please make sure to add or update tests
as appropriate.

### Installation

1. Install node.js (v12.x+ recommended)
2. Clone this repository.
3. Install dependencies via `npm install`
4. Run `npm start` to validate the cog works locally (`ctrl+c` to kill it)
5. Run `crank cog:install --source=local --local-start-command="npm start"` to
   register your local instance of this cog. You may need to append a `--force`
   flag or run `crank cog:uninstall stackmoxie/marketo` if you've already
   installed the distributed version of this cog.

### Adding/Modifying Steps
Modify code in `src/steps` and validate your changes by running
`crank cog:step stackmoxie/marketo` and selecting your step.

To add new steps, create new step classes in `src/steps`. Use existing steps as
a starting point for your new step(s). Note that you will need to run
`crank registry:rebuild` in order for your new steps to be recognized.

Always add tests for your steps in the `test/steps` folder. Use existing tests
as a guide.

### Modifying the API Client or Authentication Details
Modify the ClientWrapper class at `src/client/client-wrapper.ts`.

- If you need to add or modify authentication details, see the
  `expectedAuthFields` static property.
- If you need to expose additional logic from the wrapped API client, add a new
  ublic method to the wrapper class, which can then be called in any step.
- It's also possible to swap out the wrapped API client completely. You should
  only have to modify code within this clase to achieve that.

Note that you will need to run `crank registry:rebuild` in order for any
changes to authentication fields to be reflected. Afterward, you can
re-authenticate this cog by running `crank cog:auth stackmoxie/marketo`

### Tests and Housekeeping
Tests can be found in the `test` directory and run like this: `npm test`.
Ensure your code meets standards by running `npm run lint`.

[what-is-crank]: https://crank.run?utm_medium=readme&utm_source=stackmoxie%2Fmarketo
