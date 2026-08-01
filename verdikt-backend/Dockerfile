# Stage 1: Build the Maven application
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn
COPY src src

# Build executable jar
RUN mvn clean package -DskipTests

# Stage 2: Create lightweight execution image
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy the generated Spring Boot JAR file specifically
COPY --from=build /app/target/verdikt-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]