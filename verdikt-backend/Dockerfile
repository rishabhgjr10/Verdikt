# Stage 1: Build the Maven application
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn
COPY src src

# Build with Maven provided by the builder image. The wrapper interprets the
# image's MAVEN_CONFIG path as a Maven command-line argument.
RUN mvn clean package -DskipTests

# Stage 2: Create lightweight execution image
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
