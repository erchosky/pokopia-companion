# Planner capabilities

| Capability                     | Available | Partial | Blocked | Reason                                                                        |
| ------------------------------ | --------- | ------- | ------- | ----------------------------------------------------------------------------- |
| structural multi-goal          | yes       | no      | no      | Goal/requirement graph and immutable state are present.                       |
| shared dependency optimization | yes       | no      | no      | Nodes/actions carry all affected goals.                                       |
| resource allocation            | yes       | yes     | no      | Exact for confirmed direct requirements; recursive totals stop at batch gaps. |
| information optimization       | yes       | no      | no      | Confirmation impact is countable without estimating gameplay cost.            |
| exact materials                | no        | no      | yes     | 0/882 exact output batches.                                                   |
| power planning                 | no        | yes     | no      | Accepted generation/demand exist; layout/connectivity state is incomplete.    |
| time optimization              | no        | yes     | no      | Partial only when an accepted duration applies to the selected plan.          |
| throughput optimization        | no        | no      | yes     | Production cycles/rates remain unknown.                                       |
| range/layout optimization      | no        | yes     | yes     | Documented ranges exist; player positions do not.                             |

No existe un booleano global “planner ready”. La respuesta siempre incluye las seis capability flags
operativas y su explicación. Los flags son contextuales: power/range/time del corpus no se aplican a
un goal no relacionado.
