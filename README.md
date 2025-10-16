<div align=center>
<picture align=center>
    <source media="(prefers-color-scheme: dark)" srcset="https://assets.timescale.com/docs/images/tigerdata-gradient-white.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://assets.timescale.com/docs/images/tigerdata-gradient-black.svg">
    <img alt="TigerData logo" >
</picture>

Fork a Tiger Data database service for testing, development or ephemeral use.

</div>

## Usage Examples

### Minimal Example

```yaml
- name: Fork Database
  id: fork
  uses: timescale/fork-service@v1
  with:
    project_id: your-project-id
    service_id: your-service-id
    api_key: ${{ secrets.TIGERDATA_API_KEY }}
    fork_strategy: last-snapshot
```

### Fork for Pull Request Testing

Fork a database with automatic cleanup for testing pull requests:

```yaml
name: Test on Fork
on: pull_request

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Fork Database
        id: fork
        uses: timescale/fork-service@v1
        with:
          project_id: your-project-id
          service_id: your-service-id
          api_key: ${{ secrets.TIGERDATA_API_KEY }}
          fork_strategy: now
          cleanup: true
          name: fork-${{ github.event.pull_request.number }}

      - name: Run tests
        env:
          DATABASE_URL:
            postgresql://tsdbadmin:${{ steps.fork.outputs.initial_password
            }}@${{ steps.fork.outputs.host }}:${{ steps.fork.outputs.port
            }}/tsdb?sslmode=require
        run: npm test
```

Note that there is also a
[delete-service](https://github.com/timescale/delete-service) action that can be
used to delete the forked service on your own schedule. This can be useful if
you want to keep the forked service around for a longer period of time than the
workflow run itself.

## Inputs

| Input           | Required | Default | Description                                                                                             |
| --------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `project_id`    | Yes      | -       | The project ID of your service                                                                          |
| `service_id`    | Yes      | -       | The service ID of your service                                                                          |
| `api_key`       | Yes      | -       | A Tiger Data API key in format `publicKey:secretKey`                                                    |
| `fork_strategy` | Yes      | -       | The forking strategy: `now`, `last-snapshot`, or `timestamp`                                            |
| `target_time`   | No       | -       | Required when using `timestamp` strategy. Format: `2025-10-01T15:29:00Z`                                |
| `name`          | No       | -       | Custom name for the forked service (defaults to parent name with "-fork" suffix)                        |
| `cpu_millis`    | No       | -       | CPU allocation in milli-cores or `shared` for shared resources (defaults to parent service allocation)  |
| `memory_gbs`    | No       | -       | Memory allocation in gigabytes or `shared` for shared resources (defaults to parent service allocation) |
| `cleanup`       | No       | `false` | Whether to delete the fork after the workflow completes                                                 |

## Outputs

| Output             | Description                                 |
| ------------------ | ------------------------------------------- |
| `service_id`       | The ID of the forked service                |
| `name`             | The name of the forked service              |
| `host`             | The hostname/endpoint of the forked service |
| `port`             | The port number of the forked service       |
| `initial_password` | The initial password for the forked service |

## Forking Strategies

- **`now`**: Creates a new snapshot and forks from it (most up-to-date data)
- **`last-snapshot`**: Uses the most recent existing snapshot (faster, but may
  be slightly behind)
- **`timestamp`**: Point-in-time recovery from a specific timestamp (requires
  `target_time` input)

## Resource Allocation

You can specify the resource allocation for your forked service:

- **Dedicated resources**: Provide numeric values for `cpu_millis` and
  `memory_gbs` (e.g., `cpu_millis: "1000"` for 1 vCPU)
- **Shared resources (free tier)**: Use `shared` for both `cpu_millis` and
  `memory_gbs` to create a free tier fork with shared resources
- **Parent resources**: Omit both parameters to inherit the resource allocation
  from the parent service

### Example: Creating a Free Tier Fork

```yaml
- name: Fork Database with Free Tier
  uses: timescale/fork-service@v1
  with:
    project_id: your-project-id
    service_id: your-service-id
    api_key: ${{ secrets.TIGERDATA_API_KEY }}
    fork_strategy: last-snapshot
    cpu_millis: shared
    memory_gbs: shared
    cleanup: true
```
