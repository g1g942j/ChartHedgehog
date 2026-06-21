package com.example.backend.dto;

public class DiagramParticipantDto {
    private Long userId;
    private String username;
    private String email;
    private String fullName;
    private String role;

    public DiagramParticipantDto() {}

    public DiagramParticipantDto(Long userId, String username, String email,
                                  String fullName, String role) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.fullName = fullName;
        this.role = role;
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}
