class ChatService:

    def generate_reply(self, message: str) -> str:

        message = message.lower()

        if "hello" in message:
            return "Hey! I'm BRO 👊"

        if "hi" in message:
            return "Hi! What are we building today?"

        if "bye" in message:
            return "See you soon, Founder."

        return "I'm still learning. Tell me more."