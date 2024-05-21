Loki - index logs
Grafana tempo - distributed tracing
grafana, prometheus

* Process of understanding the internal state of an app through different indicators.
* Logs,Metrics (jvm statistics, thread count , heap memory, cpu)and Traces.(A-B-C using trace id)
* 
*   loki:
    image: grafana/loki:main
    command: [ "-config.file=/etc/loki/local-config.yaml" ]
    ports:
    - "3100:3100"

    <dependency>
    <groupId>com.github.loki4j</groupId>
    <artifactId>loki-logback-appender</artifactId>
    <version>1.3.2</version>
    </dependency>