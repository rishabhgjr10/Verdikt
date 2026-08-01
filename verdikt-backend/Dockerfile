# Stage 1: Build the Maven application
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml first to leverage Docker layer caching
COPY pom.xml .

# Copy source code and wrapper files
COPY src ./src
COPY mvnw .
COPY .mvn ./.mvn

# Build executable jar
RUN ./mvnw clean package -DskipTests

# Stage 2: Create lightweight execution image
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy the generated Spring Boot JAR
COPY --from=build /app/target/verdikt-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]